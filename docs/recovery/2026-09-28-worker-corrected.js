var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var ROOT_HOST = "peacefulmotors.com";
var WWW_HOST = "www.peacefulmotors.com";
var PRIMARY_APP_HOST = "app.peacefulmotors.com";
var BOOKING_PRODUCT_HOST = "booking.peacefulmotors.com";
var ACADEMY_HOST = "academy.peacefulmotors.com";
var SUPABASE_BOOKING_URL = "https://xsqjskbcmsjzkumbsrti.supabase.co/functions/v1/book";
var APP_HOSTS = /* @__PURE__ */ new Set([PRIMARY_APP_HOST, "os.peacefulmotors.com", "app.peacefulmotors.com"]);
var SPECIAL_HOST_PAGES = /* @__PURE__ */ new Map([
  [BOOKING_PRODUCT_HOST, "/booking-app.html"],
  [ACADEMY_HOST, "/academy.html"]
]);
var bookingHits = /* @__PURE__ */ new Map();
var PAGE_ASSETS = /* @__PURE__ */ new Map([
  ["/", "/index.html"],
  ["/index.html", "/index.html"],
  ["/services", "/services.html"],
  ["/services/", "/services.html"],
  ["/services.html", "/services.html"],
  ["/prices", "/prices.html"],
  ["/prices/", "/prices.html"],
  ["/prices.html", "/prices.html"],
  ["/pricing", "/prices.html"],
  ["/explore", "/explore.html"],
  ["/explore/", "/explore.html"],
  ["/explore.html", "/explore.html"],
  ["/terms", "/terms.html"],
  ["/terms/", "/terms.html"],
  ["/terms.html", "/terms.html"],
  ["/terms-of-service", "/terms.html"],
  ["/terms-and-conditions", "/terms.html"],
  ["/privacy", "/privacy.html"],
  ["/privacy/", "/privacy.html"],
  ["/privacy.html", "/privacy.html"],
  ["/privacy-policy", "/privacy.html"],
  ["/warranty", "/warranty.html"],
  ["/warranty/", "/warranty.html"],
  ["/warranty.html", "/warranty.html"],
  ["/policies", "/policies.html"],
  ["/policies/", "/policies.html"],
  ["/policies.html", "/policies.html"],
  ["/policy", "/policies.html"],
  ["/limits-and-liability", "/limits-and-liability.html"],
  ["/limits-and-liability/", "/limits-and-liability.html"],
  ["/limits-and-liability.html", "/limits-and-liability.html"],
  ["/limits", "/limits-and-liability.html"],
  ["/liability", "/limits-and-liability.html"],
  ["/book", "/book.html"],
  ["/book/", "/book.html"],
  ["/book.html", "/book.html"],
  ["/booking", "/book.html"],
  ["/contact", "/contact.html"],
  ["/contact/", "/contact.html"],
  ["/contact.html", "/contact.html"],
  ["/consulting-agreement", "/consulting-agreement.html"],
  ["/consulting-agreement/", "/consulting-agreement.html"],
  ["/consulting-agreement.html", "/consulting-agreement.html"],
  ["/consulting", "/consulting-agreement.html"],
  ["/dashcam", "/dashcam.html"],
  ["/dashcam/", "/dashcam.html"],
  ["/dashcam.html", "/dashcam.html"]
]);
var SECURITY_HEADERS = {
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};
function redirect(location, status = 308) {
  return new Response(null, {
    status,
    headers: { ...SECURITY_HEADERS, Location: location }
  });
}
__name(redirect, "redirect");
function withHeaders(response, extra = {}, method = "GET") {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  return new Response(method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(withHeaders, "withHeaders");
function jsonResponse(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...extra
    }
  });
}
__name(jsonResponse, "jsonResponse");
function htmlHeaders(extra = {}) {
  return {
    "Content-Type": "text/html; charset=utf-8",
    ...extra
  };
}
__name(htmlHeaders, "htmlHeaders");
function bookingRateLimited(request) {
  const key = request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const recent = (bookingHits.get(key) || []).filter((time) => now - time < 6e4);
  recent.push(now);
  bookingHits.set(key, recent);
  return recent.length > 5;
}
__name(bookingRateLimited, "bookingRateLimited");
async function handlePublicBooking(request) {
  if (bookingRateLimited(request)) return jsonResponse({ error: "Too many requests. Wait a minute or text 314-919-7456." }, 429);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 12e3) return jsonResponse({ error: "Request is too large." }, 413);
  let incoming;
  try {
    incoming = await request.json();
  } catch {
    return jsonResponse({ error: "Check the form and try again." }, 400);
  }
  const vehicleFromParts = [
    incoming.year,
    incoming.make,
    incoming.model
  ].map((value) => String(value || "").trim()).filter(Boolean).join(" ").slice(0, 80);
  const clean = {
    name: String(incoming.name || "").trim().slice(0, 80),
    phone: String(incoming.phone || "").trim().slice(0, 25),
    email: String(incoming.email || "").trim().slice(0, 120),
    vehicle: String(incoming.vehicle || vehicleFromParts || "").trim().slice(0, 80),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(incoming.date || "")) ? incoming.date : "",
    time: String(incoming.time || "").trim().slice(0, 60),
    issue: String(incoming.issue || "").trim().slice(0, 1e3),
    pref: incoming.pref === "email" ? "email" : "text",
    terms: incoming.terms === "accepted" ? "accepted" : "declined",
    service: String(incoming.service || "").trim().slice(0, 120),
    repair_area: String(incoming.repair_area || "").trim().slice(0, 140),
    parts_provider: String(incoming.parts_provider || "").trim().slice(0, 80),
    starter_estimate: String(incoming.starter_estimate || "").trim().slice(0, 120),
    address: String(incoming.address || "").trim().slice(0, 150),
    zip: String(incoming.zip || "").trim().slice(0, 10),
    vin: String(incoming.vin || "").trim().slice(0, 17),
    company: String(incoming.company || "").trim().slice(0, 50)
  };
  if (!clean.name || !clean.phone || !clean.issue || !clean.date || !clean.time || clean.terms !== "accepted") return jsonResponse({ error: "Name, phone, concern, date, appointment window, and the terms are required." }, 400);
  const canonical = {
    name: clean.name,
    phone: clean.phone,
    email: clean.email,
    service_address: [clean.address, clean.zip].filter(Boolean).join(", "),
    vehicle: clean.vehicle,
    vin: clean.vin,
    service: clean.service,
    notes: [
      clean.repair_area ? `Specific request: ${clean.repair_area}` : "",
      clean.parts_provider ? `Parts plan: ${clean.parts_provider}` : "",
      clean.starter_estimate ? `Starter range shown: ${clean.starter_estimate}` : "",
      clean.issue,
      clean.pref ? `Preferred reply: ${clean.pref}` : ""
    ].filter(Boolean).join("\n"),
    booking_date: clean.date,
    booking_window: clean.time,
    paid_claimed: false,
    company: clean.company
  };
  let upstream;
  try {
    upstream = await fetch(SUPABASE_BOOKING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(canonical)
    });
  } catch {
    return jsonResponse({ error: "Online booking is temporarily unavailable. Please text 314-919-7456." }, 503);
  }
  const body = await upstream.text();
  return new Response(body, { status: upstream.status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
__name(handlePublicBooking, "handlePublicBooking");
async function handleBookingAvailability() {
  try {
    const upstream = await fetch(SUPABASE_BOOKING_URL, { headers: { Accept: "application/json" } });
    return new Response(await upstream.text(), { status: upstream.status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  } catch {
    return jsonResponse({ error: "Availability is temporarily unavailable." }, 503);
  }
}
__name(handleBookingAvailability, "handleBookingAvailability");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const specialHostPage = SPECIAL_HOST_PAGES.get(url.hostname);
    if (request.method === "POST" && url.hostname === ROOT_HOST && url.pathname === "/api/book") {
      return withHeaders(await handlePublicBooking(request), { "Cache-Control": "no-store" }, request.method);
    }
    if (request.method === "GET" && url.hostname === ROOT_HOST && url.pathname === "/api/book") {
      return withHeaders(await handleBookingAvailability(), { "Cache-Control": "no-store" }, request.method);
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { ...SECURITY_HEADERS, Allow: "GET, HEAD" }
      });
    }
    if (url.hostname === WWW_HOST) {
      return redirect(`https://${ROOT_HOST}${url.pathname}${url.search}`);
    }
    if (url.pathname === "/healthz" || url.pathname === "/api/status") {
      return new Response(request.method === "HEAD" ? null : JSON.stringify({
        ok: true,
        service: specialHostPage ? url.hostname : "peacefulmotors-public",
        stack: "cloudflare-workers-supabase"
      }), {
        headers: {
          ...SECURITY_HEADERS,
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8"
        }
      });
    }
    if (url.pathname.startsWith("/api/")) {
      return jsonResponse({ error: "not_found" }, 404);
    }
    if (specialHostPage) {
      const cleanPath = url.pathname.toLowerCase();
      if (!["/", "/index.html", "/booking", "/book", "/academy", "/training"].includes(cleanPath)) {
        return new Response("Not Found", { status: 404, headers: SECURITY_HEADERS });
      }
      const assetUrl2 = new URL(request.url);
      assetUrl2.pathname = specialHostPage;
      const response2 = await env.ASSETS.fetch(new Request(assetUrl2, request));
      return withHeaders(response2, htmlHeaders({ "Cache-Control": "public, max-age=0, must-revalidate" }), request.method);
    }
    if (url.pathname === "/about") return redirect(`https://${ROOT_HOST}/#mission`);
    if (url.pathname === "/os" || url.pathname.startsWith("/os/")) {
      return redirect(`https://${PRIMARY_APP_HOST}/`);
    }
    const assetPath = PAGE_ASSETS.get(url.pathname.toLowerCase());
    if (!assetPath) {
      return new Response("Not Found", { status: 404, headers: SECURITY_HEADERS });
    }
    const assetUrl = new URL(request.url);
    assetUrl.pathname = assetPath;
    const response = await env.ASSETS.fetch(new Request(assetUrl, request));
    const cacheHeaders = APP_HOSTS.has(url.hostname) ? {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet"
    } : { "Cache-Control": "public, max-age=0, must-revalidate" };
    return withHeaders(response, htmlHeaders(cacheHeaders), request.method);
  }
};
export {
  index_default as default
};
