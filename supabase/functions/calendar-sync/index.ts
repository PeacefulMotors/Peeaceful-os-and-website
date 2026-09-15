import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ---------------------------------------------------------------------------
// Peaceful Motors — calendar-sync
//
// Server-side, idempotent sync of a `bookings` row to the shop's real Google
// Calendar (peacefulmotors@gmail.com), via a Google service account.
//
// POST body: { booking_id: string, phase?: "booking_created" | "payment_verified" }
//
// Required secrets (set in Supabase → Edge Functions → Secrets):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL        the service account's client_email
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY  the service account's private_key (PEM)
// Optional:
//   GOOGLE_CALENDAR_ID   defaults to peacefulmotors@gmail.com
//
// Never invites the customer, never sends Google invitation emails (no
// attendees are ever added; sendUpdates is forced to "none"). Idempotent:
// if bookings.calendar_event_id is already set, this UPDATES that event
// instead of creating a new one.
// ---------------------------------------------------------------------------

const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SA_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") || "";
const SA_KEY_RAW = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY") || "";
const CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID") || "peacefulmotors@gmail.com";
const TZ = "America/Chicago";

const DB_HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "content-type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function db(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...DB_HEADERS, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`db ${path} -> ${r.status}: ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// --- Google service-account auth (JWT bearer grant, RS256) -----------------

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

async function gcal(path: string, init: RequestInit = {}) {
  const token = await googleAccessToken();
  const r = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers || {}) },
  });
  return r;
}

// --- Booking-window -> Chicago local start/end ------------------------------

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

// Parses strings like "Morning 8:30-11:00", "Evening 6:00-8:30", "Afternoon 2:00-5:30",
// or a bare "8:30-11:00" range, into 24h start/end.
//
// Unlike earlier versions, this NEVER guesses. A booking_window we cannot
// confidently parse throws, and the caller records that as a sync failure
// (calendar_sync_status="failed", calendar_sync_error set) rather than
// creating or updating a calendar event with a fabricated time. Producers of
// booking_window (booking-page, the internal scheduler, and reschedule) are
// expected to only ever store one of the canonical "Label H:MM-H:MM" strings;
// anything else is a bug upstream that should be visible, not silently wrong
// on the shop calendar.
function parseBookingWindow(raw: string): { startH: number; startM: number; endH: number; endM: number } {
  const s = String(raw || "").trim();
  const label = (s.toLowerCase().match(/morning|midday|afternoon|evening/) || [])[0] as
    | keyof typeof LABEL_MERIDIEM
    | undefined;
  const m = s.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (m) {
    const [, sh, sm, eh, em] = m.map(Number) as unknown as number[];
    const merid = label ? LABEL_MERIDIEM[label] : undefined;
    const startMerid: "AM" | "PM" = merid ? merid.start : sh <= 7 ? "PM" : "AM";
    const endMerid: "AM" | "PM" = merid ? merid.end : eh <= 7 ? "PM" : eh === 12 ? "PM" : "AM";
    const start = to24h(sh, sm, startMerid);
    const end = to24h(eh, em, endMerid);
    return { startH: start.h, startM: start.m, endH: end.h, endM: end.m };
  }
  // Unrecognized text — never guess. Fail loudly instead of reserving a
  // fabricated 9:00-11:00 AM block on the real shop calendar.
  throw new Error(`unrecognized booking_window format: ${JSON.stringify(raw)}`);
}

function chicagoOffsetISO(dateStr: string, h: number, m: number): string {
  // America/Chicago is UTC-6 (CST) or UTC-5 (CDT). Rather than hardcode DST
  // rules, compute the offset by comparing a UTC timestamp against how
  // Intl renders it in America/Chicago for this exact date.
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

// --- Event content -----------------------------------------------------------

function buildDescription(b: any): string {
  const lines = [
    "Peaceful Motors",
    `Booking ref: ${b.short_ref || b.id}`,
    b.phone ? `Phone: ${b.phone}` : null,
    b.email ? `Email: ${b.email}` : null,
    b.vehicle ? `Vehicle: ${b.vehicle}` : null,
    b.vin ? `VIN: ${b.vin}` : null,
    b.service ? `Service: ${b.service}` : null,
    b.service_division ? `Service division: ${b.service_division}` : null,
    `Booking status: ${b.status || "new"}`,
    `Payment status: ${b.paid_claimed ? "payment_verified" : "not_verified"}`,
    b.notes ? `Notes: ${b.notes}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

function buildEvent(b: any) {
  const paid = b.status === "payment_verified" || b.paid_claimed === true;
  const tag = paid ? "[PAID]" : "[HOLD]";
  const win = parseBookingWindow(b.booking_window);
  const start = chicagoOffsetISO(b.booking_date, win.startH, win.startM);
  const end = chicagoOffsetISO(b.booking_date, win.endH, win.endM);
  return {
    summary: `${tag} ${b.name || "Customer"} — ${b.service || "Service"}`,
    description: buildDescription(b),
    location: b.service_address || undefined,
    start: { dateTime: start, timeZone: TZ },
    end: { dateTime: end, timeZone: TZ },
    transparency: "opaque",
    status: "confirmed",
    // No attendees, ever — never invite the customer, never trigger Google
    // invitation emails. sendUpdates=none below is a second belt-and-braces.
  };
}

function eventIdForBooking(bookingId: string) {
  // Google event IDs accept lowercase base32hex characters. UUID hex is a
  // deterministic, collision-resistant key, so concurrent sync calls target
  // the same event instead of creating duplicates.
  return "pm" + bookingId.toLowerCase().replace(/-/g, "");
}

async function createOrUpdateEvent(bookingId: string, event: any) {
  const eventId = eventIdForBooking(bookingId);
  let r = await gcal(`calendars/${encodeURIComponent(CALENDAR_ID)}/events?sendUpdates=none`, {
    method: "POST",
    body: JSON.stringify({ ...event, id: eventId }),
  });
  if (r.status === 409) {
    r = await gcal(
      `calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
      { method: "PATCH", body: JSON.stringify(event) },
    );
  }
  return r;
}

// --- Main --------------------------------------------------------------------

async function markSynced(bookingId: string, eventId: string) {
  await db(`bookings?id=eq.${bookingId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      calendar_event_id: eventId,
      calendar_synced_at: new Date().toISOString(),
      calendar_sync_status: "synced",
      calendar_sync_error: null,
    }),
  });
}

async function markFailed(bookingId: string, err: string) {
  try {
    await db(`bookings?id=eq.${bookingId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ calendar_sync_status: "failed", calendar_sync_error: err.slice(0, 500) }),
    });
  } catch {
    // best-effort only
  }
}

Deno.serve(async (req) => {
  if (!SERVICE_KEY || req.headers.get("authorization") !== `Bearer ${SERVICE_KEY}`) return json({ error: "Unauthorized" }, 401);
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  let body: { booking_id?: string; phase?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const bookingId = body.booking_id;
  if (!bookingId || typeof bookingId !== "string") return json({ error: "booking_id is required" }, 400);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
    return json({ error: "booking_id must be a booking UUID" }, 400);
  }

  let rows: any[];
  try {
    rows = await db(
      `bookings?id=eq.${encodeURIComponent(bookingId)}&select=id,short_ref,name,phone,email,service_address,vehicle,vin,service,service_division,notes,booking_date,booking_window,status,paid_claimed,calendar_event_id`,
    );
  } catch (e) {
    return json({ ok: false, error: `could not load booking: ${(e as Error).message}` }, 500);
  }
  const booking = rows?.[0];
  if (!booking) return json({ ok: false, error: "booking not found" }, 404);

  // Cancellation: free the calendar slot. This never touches the
  // create/update path below -- a cancelled booking short-circuits here
  // before buildEvent() is ever called, so existing sync behavior for
  // active bookings is unchanged.
  if (booking.status === "cancelled") {
    if (!booking.calendar_event_id) {
      // calendar_sync_status only allows pending|synced|failed|skipped (DB
      // check constraint) -- "synced" here means "the calendar correctly
      // reflects this booking's cancelled state" (i.e. there is nothing to
      // remove), not that the booking itself is synced/active.
      await db(`bookings?id=eq.${booking.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ calendar_sync_status: "synced", calendar_sync_error: null }),
      });
      return json({ ok: true, booking_id: booking.id, action: "cancelled_no_event" });
    }
    try {
      const r = await gcal(
        `calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(booking.calendar_event_id)}?sendUpdates=none`,
        { method: "DELETE" },
      );
      // 404/410 -- the event is already gone on Google's side. Either way
      // the calendar slot is free, so treat this as success.
      if (!r.ok && r.status !== 404 && r.status !== 410) {
        throw new Error(`google calendar delete ${r.status}: ${(await r.text()).slice(0, 300)}`);
      }
      await db(`bookings?id=eq.${booking.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ calendar_event_id: null, calendar_sync_status: "synced", calendar_sync_error: null }),
      });
      return json({ ok: true, booking_id: booking.id, action: "cancelled_event_removed" });
    } catch (e) {
      const msg = (e as Error).message || String(e);
      await markFailed(booking.id, msg);
      return json({ ok: false, booking_id: booking.id, error: msg }, 200);
    }
  }

  try {
    // buildEvent() parses booking_window and can throw for an unrecognized
    // format. That must land in the catch below (calendar_sync_error set,
    // no Google API call made, no event created/updated/deleted) rather
    // than propagate as an unhandled 500.
    const event = buildEvent(booking);

    if (booking.calendar_event_id) {
      // Idempotent update of the existing event.
      let r = await gcal(
        `calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(booking.calendar_event_id)}?sendUpdates=none`,
        { method: "PATCH", body: JSON.stringify(event) },
      );
      if (r.status === 404) {
        // The stored event id no longer exists on Google's side (e.g. deleted
        // manually). It is safe to create a fresh one — the old id is gone,
        // so this cannot produce a duplicate.
        r = await createOrUpdateEvent(booking.id, event);
      }
      if (!r.ok) throw new Error(`google calendar ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const created = await r.json();
      await markSynced(booking.id, created.id);
      return json({ ok: true, booking_id: booking.id, calendar_event_id: created.id, action: "updated" });
    } else {
      const r = await createOrUpdateEvent(booking.id, event);
      if (!r.ok) throw new Error(`google calendar ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const created = await r.json();
      await markSynced(booking.id, created.id);
      return json({ ok: true, booking_id: booking.id, calendar_event_id: created.id, action: "created" });
    }
  } catch (e) {
    const msg = (e as Error).message || String(e);
    await markFailed(booking.id, msg);
    // Never throw past this point — callers must not treat a calendar
    // failure as a booking failure.
    return json({ ok: false, booking_id: booking.id, error: msg }, 200);
  }
});
