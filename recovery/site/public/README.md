# Incomplete public asset mirror

This folder is a **partial** copy of production static assets for recovery/diffing.

**Do NOT run `wrangler deploy` from here.** Production deploys require the full merged bundle (Worker `dist/index.js` + complete `public/` + wrangler.json), currently kept at:

`docs/recovery/2026-10-05-commercial/`

Deploying this folder alone would omit the Worker script, many HTML pages, sitemap/robots, and assets binding config.
