# 2026-10-04 Academy links: router + Supabase function sync

Production sources mirrored here (deployed 4 Oct 2026, ET):

| Component | Before (rollback) | After (live) |
|---|---|---|
| Cloudflare Worker `peaceful-os-app-router` | `100b508d-4dfc-4d1a-8778-28750a8f235a` | `4d8f0612-3232-4f99-ae7b-e207721d9114` (tag `academy-links-20261004`) |
| Supabase function `video-studio` | v7 | v8 |
| Supabase function `tech-app` | v26 | v27 |

## What changed
- Router (`everyone-app/worker.js`): routes `academy.peacefulmotors.com/video-studio` to the `video-studio` function; serves Academy-host HTML as `text/html` with the app CSP; rewrites raw `*.supabase.co/functions/v1/shop-app-academy` and `/video-studio` links in Owner/Tech/Academy HTML to `https://academy.peacefulmotors.com`.
- `everyone-app/wrangler.jsonc` now mirrors the live triggers: zone route `academy.peacefulmotors.com/*` plus custom domains inspect, owner, tech, customer, schedule. `workers_dev=false`, `preview_urls=false`. (booking/customers/contacts are NOT bound to this Worker in production.)
- `video-studio` v8: fixed lesson-card `onclick` quoting (`watch('<id>')`, `openQuiz('<id>')`) and pointed the Academy link at `https://academy.peacefulmotors.com/`.
- `tech-app` v27: fixed job-card `onclick` quoting for Start Job / Complete (`status('<id>','in_progress'|'complete')`).
- No auth, RLS, data, or quiz-answer exposure changes.

## Rollback
- Router: `npx wrangler versions deploy 100b508d-4dfc-4d1a-8778-28750a8f235a@100% --name peaceful-os-app-router -y`
- Functions: undo only the lines listed above (the v7/v26 sources differ from these files only there) and redeploy with the same name, `verify_jwt=false`, entrypoint `index.ts`. Byte-exact v7/v26 backups were also kept with the audit artifacts.

## CI note
`.github/workflows/deploy-cloudflare-app-router.yml` runs `wrangler deploy` on push to `main` touching `everyone-app/**`. All prior runs failed on missing secrets. This sync was committed to branch `academy-router-sync` so merging is a deliberate decision.
