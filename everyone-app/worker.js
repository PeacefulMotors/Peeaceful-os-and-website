const SUPABASE_BASE = "https://xsqjskbcmsjzkumbsrti.supabase.co/functions/v1";

// IMPORTANT: Do not bind this Worker to peacefulmotors.com, app., os., beta.,
// or book. Those hostnames already serve live Peaceful Motors surfaces.
// This router is only for new, non-destructive app hostnames.
const HOST_TO_FUNCTION = {
  "inspect.peacefulmotors.com": "inspect",
  "owner.peacefulmotors.com": "owner-app",
  "tech.peacefulmotors.com": "tech-app",
  "customer.peacefulmotors.com": "customer-app",
  "booking.peacefulmotors.com": "booking-page",
  "schedule.peacefulmotors.com": "scheduler",
  "customers.peacefulmotors.com": "customer-database-app",
  "contacts.peacefulmotors.com": "customer-database-app",
  "academy.peacefulmotors.com": "shop-app-academy",
};

function securityHeaders(headers) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)");
  headers.set("Cache-Control", "no-store");
  return headers;
}

function looksLikeHtml(text) {
  const start = text.slice(0, 512).trimStart().toLowerCase();
  return start.startsWith("<!doctype html") || start.startsWith("<html") || start.includes("<head") || start.includes("<body");
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const fn = HOST_TO_FUNCTION[incoming.hostname];

    if (!fn) {
      return new Response("Peaceful OS route not configured", {
        status: 404,
        headers: securityHeaders(new Headers({ "content-type": "text/plain; charset=utf-8" })),
      });
    }

    const upstream = new URL(`${SUPABASE_BASE}/${fn}`);
    upstream.search = incoming.search;

    const init = {
      method: request.method,
      headers: new Headers(request.headers),
      redirect: "manual",
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
        headers: securityHeaders(new Headers({ "content-type": "text/plain; charset=utf-8" })),
      });
    }

    const headers = securityHeaders(new Headers(response.headers));
    const contentType = (headers.get("content-type") || "").toLowerCase();
    const wantsHtml = (request.headers.get("accept") || "").toLowerCase().includes("text/html");

    // Some Supabase Edge Functions return complete HTML documents with the default
    // text/plain content type. With X-Content-Type-Options: nosniff, browsers correctly
    // refuse to render those responses as HTML and show source text instead. Only
    // normalize the MIME type when a browser asked for HTML and the payload actually
    // looks like an HTML document. JSON/API/error responses keep their original type.
    if (request.method !== "HEAD" && wantsHtml && (contentType.startsWith("text/plain") || !contentType)) {
      const text = await response.text();
      if (looksLikeHtml(text)) {
        headers.set("content-type", "text/html; charset=utf-8");
      }
      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
