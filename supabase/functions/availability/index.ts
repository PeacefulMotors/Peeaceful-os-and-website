import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ---------------------------------------------------------------------------
// Peaceful — availability
//
// THE canonical, privacy-safe availability engine for Peaceful booking
// surfaces. Any public or internal booking UI should read slots from here
// instead of hardcoding a window list or talking to Google Calendar itself.
//
// GET /availability?start=YYYY-MM-DD&end=YYYY-MM-DD
//   start/end optional. Defaults: start = today (America/Chicago),
//   end = start + 90 days (matches the public booking horizon in book).
//   Range is capped at 92 days: Google freeBusy rejects longer ranges, and a
//   rejected freeBusy call makes every slot fail closed.
//
// Response (ALWAYS this shape, nothing else):
//   {
//     timezone: "America/Chicago",
//     slots: [
//       { date: "2026-09-14", window: "Evening 6:00-8:30",
//         start: "2026-09-14T23:00:00.000Z", end: "2026-09-15T01:30:00.000Z",
//         available: true },
//       ...
//     ]
//   }
//
// Privacy contract (do not weaken this):
//   - Slots never carry customer data, booking IDs, calendar event IDs,
//     event titles/descriptions, or attendee/location info.
//   - The private Google Calendar is only ever queried via freeBusy.query,
//     which structurally cannot return event details — only busy time
//     ranges. Never switch this to events.list for this function.
//
// Availability = canonical operating window (from app_data.booking_windows)
//   AND NOT already taken by a non-cancelled DB booking
//   AND NOT overlapping a busy period on the shop's private calendar
//   AND NOT already in the past (for windows later today).
//
// Optional buffer: app_data key "travel_buffer_minutes" (integer). If
// present, busy periods are padded by this many minutes on each side before
// being checked against window start/end. Defaults to 0 (no behavior change)
// if the key is absent.
//
// v3 (4 Oct 2026, owner-approved schedule) adds three optional config keys
// inside app_data.booking_windows. All are optional, so older configs behave
// exactly as before:
//   closed_dates: ["YYYY-MM-DD"]        -> no windows at all on those dates
//   evening_open_dates: ["YYYY-MM-DD"]  -> weekday dates where the evening
//                                          window is intentionally opened
//   evening_window: "Evening 6:00-8:30" -> label added on those dates
//   known_blocks: [{label, days:[1..5], start:"08:00", end:"08:45"}]
//      A recurring owner block that is already on the calendar (the weekday
//      parts pickup). A busy period that exactly matches a known block still
//      blocks any window that starts before the block starts. A window that
//      starts inside the block (the owner-approved Morning 8:30 arrival window
//      after the 8:00-8:45 pickup) is not blocked by it. Any busy period that
//      does not exactly match a known block blocks normally.
// ---------------------------------------------------------------------------

const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SA_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") || "";
const SA_KEY_RAW = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY") || "";
const CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID") || "peacefulmotors@gmail.com";
const TZ = "America/Chicago";
const MAX_RANGE_DAYS = 92;
const DEFAULT_RANGE_DAYS = 90;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const DB_HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "content-type": "application/json",
};

async function db(path: string) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: DB_HEADERS });
  if (!r.ok) throw new Error(`db ${path} -> ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// --- Google service-account auth (JWT bearer grant, RS256) -----------------
// Same credentials calendar-sync already uses; read-only use here (freeBusy).

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const norm = pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
  const b64 = norm
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

let cachedToken: { token: string; exp: number } | null = null;

async function googleAccessToken(): Promise<string> {
  if (!SA_EMAIL || !SA_KEY_RAW) throw new Error("Google service account is not configured (missing secrets)");
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: SA_EMAIL,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const encHeader = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const encClaim = b64url(new TextEncoder().encode(JSON.stringify(claim)));
  const signingInput = `${encHeader}.${encClaim}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(SA_KEY_RAW),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${b64url(sig)}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!r.ok) throw new Error(`google token exchange failed: ${r.status} ${await r.text()}`);
  const t = await r.json();
  cachedToken = { token: t.access_token, exp: now + (t.expires_in || 3600) };
  return cachedToken.token;
}

// Returns busy intervals as [{startMs, endMs}]. Never returns event details —
// freeBusy.query structurally cannot return summaries/attendees/locations.
async function fetchBusyIntervals(timeMinISO: string, timeMaxISO: string): Promise<{ startMs: number; endMs: number }[]> {
  if (!SA_EMAIL || !SA_KEY_RAW) {
    // Google not configured: fail toward "nothing known busy" would hide a
    // real outage as false availability, and failing toward "everything
    // busy" would take the whole shop offline on a secrets typo. We choose
    // to surface the failure to the caller instead of guessing either way.
    throw new Error("calendar not configured");
  }
  const token = await googleAccessToken();
  const r = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ timeMin: timeMinISO, timeMax: timeMaxISO, items: [{ id: CALENDAR_ID }] }),
  });
  if (!r.ok) throw new Error(`freebusy failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  const calendar=j?.calendars?.[CALENDAR_ID];
  if(!calendar||calendar.errors?.length||!Array.isArray(calendar.busy))throw new Error("Calendar availability unavailable");
  const busy = calendar.busy;
  return busy.map((b: { start: string; end: string }) => ({
    startMs: new Date(b.start).getTime(),
    endMs: new Date(b.end).getTime(),
  }));
}

// --- Canonical booking-window config (app_data.booking_windows) ------------

type Phase = { from: string; until?: string; days: Record<string, string[]> };
type KnownBlock = { label?: string; days: number[]; start: string; end: string };
type WindowsConfig = {
  timezone: string;
  phases: Phase[];
  closed_dates?: string[];
  evening_open_dates?: string[];
  evening_window?: string;
  known_blocks?: KnownBlock[];
};

function phaseForDate(dateStr: string, cfg: WindowsConfig): Phase | null {
  const sorted = [...cfg.phases].sort((a, b) => (a.from < b.from ? -1 : 1));
  let chosen: Phase | null = null;
  for (const p of sorted) {
    if (dateStr >= p.from && (!p.until || dateStr <= p.until)) chosen = p;
  }
  return chosen;
}

function windowLabelsForDate(dateStr: string, cfg: WindowsConfig): string[] {
  if (Array.isArray(cfg.closed_dates) && cfg.closed_dates.includes(dateStr)) return [];
  const phase = phaseForDate(dateStr, cfg);
  if (!phase) return [];
  const dowNum = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  const labels = [...(phase.days[String(dowNum)] || [])];
  const evening = typeof cfg.evening_window === "string" ? cfg.evening_window : "";
  if (
    evening &&
    dowNum >= 1 && dowNum <= 5 &&
    Array.isArray(cfg.evening_open_dates) &&
    cfg.evening_open_dates.includes(dateStr) &&
    !labels.includes(evening)
  ) labels.push(evening);
  return labels;
}

function hm(v: string): { h: number; m: number } | null {
  const m = String(v || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  return h <= 23 && mm <= 59 ? { h, m: mm } : null;
}

// Known blocks for one date as [{startMs,endMs}] in absolute time.
function knownBlocksForDate(dateStr: string, cfg: WindowsConfig): { startMs: number; endMs: number }[] {
  if (!Array.isArray(cfg.known_blocks)) return [];
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  const out: { startMs: number; endMs: number }[] = [];
  for (const b of cfg.known_blocks) {
    if (!b || !Array.isArray(b.days) || !b.days.includes(dow)) continue;
    const s = hm(b.start), e = hm(b.end);
    if (!s || !e) continue;
    out.push({
      startMs: new Date(chicagoOffsetISO(dateStr, s.h, s.m)).getTime(),
      endMs: new Date(chicagoOffsetISO(dateStr, e.h, e.m)).getTime(),
    });
  }
  return out;
}

// Same label -> AM/PM disambiguation and generic "H:MM-H:MM" parsing as
// calendar-sync's parseBookingWindow, so a window this function marks
// available resolves to the exact same wall-clock time calendar-sync will
// later put on the calendar. Keep these two in sync if either changes.
const LABEL_MERIDIEM: Record<string, { start: "AM" | "PM"; end: "AM" | "PM" }> = {
  morning: { start: "AM", end: "AM" },
  midday: { start: "AM", end: "PM" },
  afternoon: { start: "PM", end: "PM" },
  evening: { start: "PM", end: "PM" },
};

function to24h(h: number, m: number, meridiem: "AM" | "PM"): { h: number; m: number } {
  let hh = h % 12;
  if (meridiem === "PM") hh += 12;
  return { h: hh, m };
}

function parseWindowLabel(raw: string): { startH: number; startM: number; endH: number; endM: number } | null {
  const s = String(raw || "").trim();
  const label = (s.toLowerCase().match(/morning|midday|afternoon|evening/) || [])[0] as
    | keyof typeof LABEL_MERIDIEM
    | undefined;
  const m = s.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, sh, sm, eh, em] = m.map(Number) as unknown as number[];
  const merid = label ? LABEL_MERIDIEM[label] : undefined;
  const startMerid: "AM" | "PM" = merid ? merid.start : sh <= 7 ? "PM" : "AM";
  const endMerid: "AM" | "PM" = merid ? merid.end : eh <= 7 ? "PM" : eh === 12 ? "PM" : "AM";
  const start = to24h(sh, sm, startMerid);
  const end = to24h(eh, em, endMerid);
  return { startH: start.h, startM: start.m, endH: end.h, endM: end.m };
}

function chicagoOffsetISO(dateStr: string, h: number, m: number): string {
  const guessUTC = new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guessUTC);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const renderedUTCms = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const offsetMs = guessUTC.getTime() - renderedUTCms;
  const actualUTC = new Date(guessUTC.getTime() + offsetMs);
  return actualUTC.toISOString();
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayChicago(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "GET") return json({ error: "method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const today = todayChicago();
    let start = url.searchParams.get("start") || today;
    let end = url.searchParams.get("end") || addDays(start, DEFAULT_RANGE_DAYS);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return json({ error: "start and end must be YYYY-MM-DD" }, 400);
    }
    if (end < start) [start, end] = [end, start];
    if (addDays(start, MAX_RANGE_DAYS) < end) end = addDays(start, MAX_RANGE_DAYS);

    const cfgRow = await db(`app_data?key=eq.booking_windows&select=value`);
    let cfg: WindowsConfig | null = null;
    try {
      cfg = cfgRow && cfgRow[0] ? JSON.parse(cfgRow[0].value) : null;
    } catch {
      cfg = null;
    }
    if (!cfg) return json({ error: "booking_windows config missing or invalid" }, 500);

    let bufferMinutes = 0;
    try {
      const bufRow = await db(`app_data?key=eq.travel_buffer_minutes&select=value`);
      const n = bufRow && bufRow[0] ? Number(bufRow[0].value) : 0;
      if (Number.isFinite(n) && n > 0) bufferMinutes = n;
    } catch {
      // absent/invalid -> no buffer, matches current behavior
    }

    const takenRows =
      (await db(
        `bookings?select=booking_date,booking_window&status=neq.cancelled&booking_date=gte.${start}&booking_date=lte.${end}`,
      )) || [];
    const taken = new Set<string>(takenRows.map((r: any) => `${r.booking_date}|${r.booking_window}`));

    // Build every candidate slot first (so we know the true time bounds of
    // the request) before making a single freeBusy call for the whole range.
    type Candidate = { date: string; window: string; startISO: string; endISO: string; known: { startMs: number; endMs: number }[] };
    const candidates: Candidate[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      for (const w of windowLabelsForDate(d, cfg)) {
        const parsed = parseWindowLabel(w);
        if (!parsed) continue; // malformed config entry -- skip rather than guess
        candidates.push({
          date: d,
          window: w,
          startISO: chicagoOffsetISO(d, parsed.startH, parsed.startM),
          endISO: chicagoOffsetISO(d, parsed.endH, parsed.endM),
          known: knownBlocksForDate(d, cfg),
        });
      }
    }

    let busy: { startMs: number; endMs: number }[] = [];
    let calendarError: string | null = null;
    if (candidates.length) {
      // Include known-block bounds: freeBusy clips busy periods to the query
      // range, and a clipped block would no longer match its known block.
      const knownStarts = candidates.flatMap((c) => c.known.map((k) => k.startMs));
      const knownEnds = candidates.flatMap((c) => c.known.map((k) => k.endMs));
      const timeMin = new Date(Math.min(...candidates.map((c) => new Date(c.startISO).getTime()), ...knownStarts)).toISOString();
      const timeMax = new Date(Math.max(...candidates.map((c) => new Date(c.endISO).getTime()), ...knownEnds)).toISOString();
      try {
        busy = await fetchBusyIntervals(timeMin, timeMax);
      } catch (e) {
        // Fail closed: if we cannot verify the private calendar, do not tell
        // customers a slot is available when we have no way to be sure.
        calendarError = (e as Error).message || String(e);
      }
    }

    const bufferMs = bufferMinutes * 60 * 1000;
    const nowMs = Date.now();
    const slots = candidates.map((c) => {
      const startMs = new Date(c.startISO).getTime();
      const endMs = new Date(c.endISO).getTime();
      const inPast = startMs < nowMs;
      const dbTaken = taken.has(`${c.date}|${c.window}`);
      const calendarBusy = calendarError
        ? true // fail closed
        : busy.some((b) => {
            // A busy period that is exactly a configured known block (to the
            // minute) is the owner's own recurring block. It still blocks any
            // window that starts before the block starts, but the arrival
            // window that begins inside the block's tail is allowed, as
            // approved. Every other busy period blocks normally.
            const isKnown = c.known.some((k) => Math.abs(k.startMs - b.startMs) < 60000 && Math.abs(k.endMs - b.endMs) < 60000);
            if (isKnown && startMs >= b.startMs) return false;
            return startMs < b.endMs + bufferMs && endMs > b.startMs - bufferMs;
          });
      return {
        date: c.date,
        window: c.window,
        start: c.startISO,
        end: c.endISO,
        available: !inPast && !dbTaken && !calendarBusy,
      };
    });

    return json({ timezone: TZ, slots, ...(calendarError ? { calendar_status: "unavailable" } : {}) });
  } catch (e) {
    console.error("availability check failed",e);
    return json({ error: "availability check failed" }, 500);
  }
});
