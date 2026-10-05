# Deploy source map (Peaceful Motors Workers)

Paths under `deploy/**` are **manual** source mirrors. They do **not** match `everyone-app/**`, so the only CI workflow (`deploy-cloudflare-app-router.yml`) does **not** run from these commits. Do not enable CI deploy from this tree.

## Workers

| Worker | Hostnames | Source dir | Production version | Rollback |
|---|---|---|---|---|
| `peaceful-motors-free-commercial` | `peacefulmotors.com`, `www`, `booking`, `academy` | `deploy/commercial-worker/` | `880dba0c-4bde-4d2e-aaf0-67c0bfad9be3` | `4315c22e-445b-4efc-a628-703dd7303b6c` |
| `peaceful-motors-app` | `app.peacefulmotors.com`, `os`, `beta` | `deploy/peaceful-motors-app/` | `fda1bb2d-8177-4688-aff9-dbaf21d6eecc` | (prior app version per Cloudflare dashboard) |
| `peaceful-os-app-router` | router / `everyone-app` | `everyone-app/` (unchanged this pass) | `4d8f0612…` | prior router version |

## Manual deploy (commercial)

```bash
export PATH=~/.local/node22/bin:$PATH
export CLOUDFLARE_ACCOUNT_ID=b0f16a5aafa1f7a3a3264871c1191565
cd deploy/commercial-worker
npx wrangler versions upload --name peaceful-motors-free-commercial
npx wrangler versions deploy <NEW_VERSION_ID>@100% --name peaceful-motors-free-commercial -y
```

Rollback commercial:

```bash
npx wrangler versions deploy 4315c22e-445b-4efc-a628-703dd7303b6c@100% --name peaceful-motors-free-commercial -y
```

## GitHub sync status (Oct 5 final pass)

Byte-compared against local commit `684239612eb60cbdd2f7befd62bfcb34ce78b310` and live bundle `/workspace/redteam-2026-10-05/commercial-ppi/`.

**On main (EQUAL):** README, VERSION.md files, wrangler.json (trailing newline only DIFF), `_headers`, `robots.txt`, `sitemap.xml`, `booking-app.html`, `booking-confirmed.html`, `prices.html`, `services.html`, `explore.html`, `contact.html`, `index.html`, `policies.html`, app `routes.json`.

**Still missing or incomplete on main (need `git push` of commit 6842396):**
- `commercial-worker/dist/index.js` (pointer stub only — **do not deploy**)
- `commercial-worker/public/app.js` (PPI catalog — critical)
- `commercial-worker/public/styles.css`
- `commercial-worker/public/assets/peaceful-motors-logo.webp`
- `commercial-worker/public/{book,privacy,dashcam,warranty,terms,limits-and-liability,consulting-agreement}.html`
- `peaceful-motors-app/worker.js`

Finish from a machine with repo write credentials (box had no git HTTPS auth):

```bash
# Preferred: push the exact local commit that already holds the full tree
cd /path/to/Peeaceful-os-and-website   # with commit 6842396
git push origin main
# then sha256sum every deploy/ file vs commercial-ppi / live app script
```

No secrets belong in this tree. App `worker.js` uses `env.*` only (anon Supabase keys OK if present; redact secret keys).
