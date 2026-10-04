import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ---------------------------------------------------------------------------
// Peaceful Motors - booking-page (v17, 4 Oct 2026)
//
// This function used to serve its own HTML booking form. The Supabase gateway
// serves function HTML as text/plain, so customers returning from the Stripe
// booking-hold Payment Link (success_url points here with ?paid=1) saw raw
// HTML source on iPhone Safari.
//
// Now it does two narrow things:
//   1. GET ?status=1&ref=XXXXXXXX  or  ?status=1&session_id=cs_...
//      Minimal JSON booking-hold status for the branded return page
//      (peacefulmotors.com/booking/confirmed, via the Worker's
//      /api/booking-status). No names, phones, emails, addresses, vehicles,
//      or Stripe ids are returned. hold_verified is true only when the booking
//      row has booking_hold_paid_at AND a paid booking_hold row exists in
//      stripe_reconciliation_events (both written only by the signed Stripe
//      webhook). URL parameters are never treated as proof of payment.
//   2. Any other GET: 302 redirect to the branded site.
//      With paid/session_id/booked/ref params -> /booking/confirmed
//      (params passed through as display hints only), otherwise -> /book.
// ---------------------------------------------------------------------------

const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE = "https://peacefulmotors.com";
const REF_RE = /^[0-9A-F]{8}$/;
const SESSION_RE = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BASE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": SITE },
  });
}

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { ...BASE_HEADERS, Location: location } });
}

async function db(path: string) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!r.ok) throw new Error(`db ${r.status}`);
  return await r.json();
}

async function status(url: URL) {
  const ref = (url.searchParams.get("ref") || "").trim().toUpperCase();
  const session = (url.searchParams.get("session_id") || "").trim();
  let filter = "";
  if (REF_RE.test(ref)) filter = `short_ref=eq.${ref}`;
  else if (SESSION_RE.test(session)) filter = `stripe_checkout_session_id=eq.${encodeURIComponent(session)}`;
  else return json({ ok: false, error: "invalid_reference" }, 400);
  try {
    const rows = await db(
      `bookings?${filter}&select=id,short_ref,booking_date,booking_window,status,booking_hold_paid_at,booking_hold_amount&limit=2`,
    );
    if (!Array.isArray(rows) || rows.length !== 1) return json({ ok: true, found: false });
    const b = rows[0];
    let reconciled = false;
    if (b.booking_hold_paid_at) {
      const ev = await db(
        `stripe_reconciliation_events?booking_id=eq.${b.id}&status=eq.paid&payment_kind=eq.booking_hold&select=amount_cents,paid_at&order=paid_at.desc&limit=1`,
      );
      reconciled = Array.isArray(ev) && ev.length === 1;
    }
    const verified = !!b.booking_hold_paid_at && reconciled;
    return json({
      ok: true,
      found: true,
      ref: String(b.short_ref || "").toUpperCase(),
      hold_verified: verified,
      amount: verified && b.booking_hold_amount != null ? Number(b.booking_hold_amount) : null,
      booking_date: b.booking_date || null,
      booking_window: b.booking_window || null,
      cancelled: b.status === "cancelled",
    });
  } catch (_e) {
    return json({ ok: false, error: "status_unavailable" }, 503);
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...BASE_HEADERS, "Access-Control-Allow-Origin": SITE, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
  }
  if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "method not allowed" }, 405);
  if (url.searchParams.get("status") === "1") return await status(url);

  const out = new URLSearchParams();
  if (url.searchParams.get("paid") === "1") out.set("paid", "1");
  const session = (url.searchParams.get("session_id") || "").trim();
  if (SESSION_RE.test(session)) out.set("session_id", session);
  const ref = (url.searchParams.get("ref") || "").trim().toUpperCase();
  const booked = (url.searchParams.get("booked") || "").trim();
  if (REF_RE.test(ref)) out.set("ref", ref);
  else if (UUID_RE.test(booked)) out.set("ref", booked.slice(0, 8).toUpperCase());
  const qs = out.toString();
  return redirect(qs ? `${SITE}/booking/confirmed?${qs}` : `${SITE}/book`);
});
