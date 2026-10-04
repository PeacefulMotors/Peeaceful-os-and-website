// peaceful-os-app-router — Academy link/MIME repair (2026-10-04)
// Base: live version 100b508d-4dfc-4d1a-8778-28750a8f235a (unchanged host map, headers, proxy logic).
// Change (narrow): (1) academy.peacefulmotors.com/video-studio proxies the existing video-studio function;
// (2) academy-host HTML documents are served as text/html with the same CSP the zone header rule
//     already applies to "/" (Supabase returns HTML as text/plain + sandbox CSP on non-root paths);
// (3) in HTML documents from owner/tech/academy hosts, raw supabase.co links to the Academy and
//     Video Studio (which render as source text on phones) are pointed at academy.peacefulmotors.com.
// API (?api=...), JSON, non-GET, and all other hosts/paths are passed through exactly as before.
var SUPABASE_BASE = "https://xsqjskbcmsjzkumbsrti.supabase.co/functions/v1";
var HOST_TO_FUNCTION = {
  "inspect.peacefulmotors.com": "inspect",
  "owner.peacefulmotors.com": "owner-app",
  "tech.peacefulmotors.com": "tech-app",
  "customer.peacefulmotors.com": "customer-app",
  "booking.peacefulmotors.com": "booking-page",
  "schedule.peacefulmotors.com": "scheduler",
  "customers.peacefulmotors.com": "customer-database-app",
  "contacts.peacefulmotors.com": "customer-database-app",
  "academy.peacefulmotors.com": "shop-app-academy"
};
var ACADEMY_HOST = "academy.peacefulmotors.com";
var ACADEMY_PATH_TO_FUNCTION = { "/video-studio": "video-studio", "/video-studio/": "video-studio" };
var LINK_REWRITE_HOSTS = new Set(["owner.peacefulmotors.com", "tech.peacefulmotors.com", ACADEMY_HOST]);
var RAW_ACADEMY = SUPABASE_BASE + "/shop-app-academy";
var RAW_VIDEO = SUPABASE_BASE + "/video-studio";
var APP_HTML_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' data: blob:; connect-src 'self' https://xsqjskbcmsjzkumbsrti.supabase.co https://vpic.nhtsa.dot.gov; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
function securityHeaders(headers) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)");
  headers.set("Cache-Control", "no-store");
  return headers;
}
function looksLikeHtml(text) {
  const start = text.slice(0, 512).trimStart().toLowerCase();
  return start.startsWith("<!doctype html") || start.startsWith("<html");
}
function rewriteAcademyLinks(text) {
  return text.split(RAW_VIDEO).join("https://" + ACADEMY_HOST + "/video-studio").split(RAW_ACADEMY).join("https://" + ACADEMY_HOST + "/");
}
var worker_default = {
  async fetch(request) {
    const incoming = new URL(request.url);
    let fn = HOST_TO_FUNCTION[incoming.hostname];
    if (!fn) {
      return new Response("Peaceful OS route not configured", {
        status: 404,
        headers: securityHeaders(new Headers({ "content-type": "text/plain; charset=utf-8" }))
      });
    }
    const isAcademy = incoming.hostname === ACADEMY_HOST;
    if (isAcademy && ACADEMY_PATH_TO_FUNCTION[incoming.pathname]) fn = ACADEMY_PATH_TO_FUNCTION[incoming.pathname];
    const upstream = new URL(`${SUPABASE_BASE}/${fn}`);
    upstream.search = incoming.search;
    const init = {
      method: request.method,
      headers: new Headers(request.headers),
      redirect: "manual"
    };
    init.headers.set("X-Forwarded-Host", incoming.hostname);
    init.headers.set("X-Peaceful-Edge", "cloudflare");
    init.headers.delete("host");
    if (!["GET", "HEAD"].includes(request.method)) {
      init.body = request.body;
    }
    let response;
    try {
      response = await fetch(upstream.toString(), init);
    } catch {
      return new Response("Peaceful OS upstream temporarily unavailable", {
        status: 502,
        headers: securityHeaders(new Headers({ "content-type": "text/plain; charset=utf-8" }))
      });
    }
    const headers = securityHeaders(new Headers(response.headers));
    const ct = (headers.get("content-type") || "").toLowerCase();
    const isDocRequest = request.method === "GET" && !incoming.searchParams.has("api") && response.status === 200 && (ct.startsWith("text/plain") || ct.startsWith("text/html"));
    if (isDocRequest && LINK_REWRITE_HOSTS.has(incoming.hostname)) {
      const text = await response.text();
      if (!looksLikeHtml(text)) {
        return new Response(text, { status: response.status, statusText: response.statusText, headers });
      }
      if (isAcademy) {
        headers.set("content-type", "text/html; charset=utf-8");
        headers.set("content-security-policy", APP_HTML_CSP);
      }
      headers.delete("content-length");
      return new Response(rewriteAcademyLinks(text), { status: response.status, statusText: response.statusText, headers });
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
export {
  worker_default as default
};
