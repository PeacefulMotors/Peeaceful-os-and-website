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
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
