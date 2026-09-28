# Dash cam route — exact Worker fix, 28 September 2026

Target: Cloudflare Worker `peaceful-motors-free-commercial` (id `1c96e5df59774f3e8c29fbc5e086b993`).

## Verified live state (read via Cloudflare Developer Platform MCP connector, this session)
- Live `index.js` fetched directly from Cloudflare via `workers_get_worker_code` — captured in full below/adjacent (`worker-current.js`).
- `https://peacefulmotors.com/dashcam` → **404** (no PAGE_ASSETS entry for `/dashcam`).
- `https://peacefulmotors.com/dashcam.html` → **404** (the static asset itself has not been uploaded/redeployed to the Worker's `env.ASSETS` bundle either — source-only in GitHub commit `1c4fa1534f92933b782dd8151be38729f3040fd0`, not yet in the deployed asset bundle).
- `/`, `/book`, `/prices`, `/terms`, `/policies` all confirmed live and unaffected — 200 OK.

## Why this session could not deploy it
This session has read-only Cloudflare access (`workers_list` / `workers_get_worker` / `workers_get_worker_code` only — no `workers_put_worker`/deploy tool, no Wrangler credentials, no outbound network path to the Cloudflare API from the sandbox shell). Per doc `2026-09-16` (`docs/PRODUCTION_FINISH_2026-09-16.md`), the GitHub Actions Cloudflare deploy workflow in this repo only targets a *different* Worker (`peaceful-os-app-router`) and has been failing on missing secrets for its last 5 runs — it cannot ship this either.

## The fix (verified minimal — nothing else changes)
Add exactly three entries to the existing `PAGE_ASSETS` map in `index.js` (same pattern already used for every other static page on this Worker — `/prices`, `/terms`, `/policies`, etc.):

```diff
   ["/consulting-agreement", "/consulting-agreement.html"],
   ["/consulting-agreement/", "/consulting-agreement.html"],
   ["/consulting-agreement.html", "/consulting-agreement.html"],
-  ["/consulting", "/consulting-agreement.html"]
+  ["/consulting", "/consulting-agreement.html"],
+  ["/dashcam", "/dashcam.html"],
+  ["/dashcam/", "/dashcam.html"],
+  ["/dashcam.html", "/dashcam.html"]
 ]);
```

No routing logic, security headers, booking API, or any other host/path mapping is touched.

## Two things whoever has Cloudflare write access must do
1. **Deploy the corrected script** (`worker-corrected.js`, next to this file) as the new version of `peaceful-motors-free-commercial` — via `wrangler deploy` or the Cloudflare dashboard Quick Edit, same mechanism as every prior deploy of this Worker.
2. **Include `recovery/site/public/dashcam.html`** (already committed at `1c4fa1534f92933b782dd8151be38729f3040fd0`) in that same deploy's static asset bundle — the route fix alone is not enough if the file itself isn't in the bundle. Both `/dashcam` and `/dashcam.html` currently 404, confirming the asset isn't in the live bundle yet.

## After deploying
Re-run the full acceptance pass from the canonical closeout prompt (Notion: "Dash cam page spec + handoff prompts — 11 Sep 2026") against the live URLs — `/`, `/dashcam`, `/book`, `/prices`, `/terms`, `/policies` — before marking DASH CAM: LIVE / VERIFIED. Do not mark it live from this file alone.

## Rollback
Current live version has no dashcam route at all (confirmed 404 above) — that is the rollback target if the new deploy causes any regression on the five existing routes.


## OWNER UPDATE — 28 September 2026 — Dash Kit customer route

Owner wants the customer-facing service visible from the Peaceful Motors homepage as **Dash Cam Kits** and reachable at `https://peacefulmotors.com/dashkit`.

Preserve the already-working `/dashcam` route as a backward-compatible alias. Do not create a new subdomain, CNAME, Worker, site, Stripe product, or booking system.

Required Worker aliases to the same existing asset:

```diff
+ ["/dashkit", "/dashcam.html"],
+ ["/dashkit/", "/dashcam.html"],
+ ["/dashkit.html", "/dashcam.html"]
```

The page canonical URL is now `https://peacefulmotors.com/dashkit`. The homepage source now includes a **Dash Cam Kits** card linking to `/dashkit`. The page's inline CSS and inline color styles were removed and moved into the existing `/styles.css` so the current CSP (`style-src 'self'`) can render the intended design without weakening security.

Source commits:
- dash kit page copy/canonical/CSP cleanup: `ec47a9917bf03422f1ed48d131f745df77ee5031`
- external dash kit styles: `cc661a48d7505318cd5c3cd10fc3625d077dcac5`
- homepage Dash Cam Kits visibility: `f0d071f913f87e57a361ea54d0f083f866c1666c`

Deployment is not complete until the existing `peaceful-motors-free-commercial` Worker asset bundle is redeployed with the updated `index.html`, `dashcam.html`, and `styles.css`, and the three `/dashkit` aliases are added to PAGE_ASSETS. Verify `/dashkit`, `/dashcam`, homepage, all 8 Stripe links, mobile styling, and existing regression routes before marking LIVE/VERIFIED.
