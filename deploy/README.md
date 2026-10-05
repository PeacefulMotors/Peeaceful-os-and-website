# Deploy source map (manual only)

These directories are the exact production snapshots for Cloudflare Workers. They do **not** live under `everyone-app/**`, so the router CI workflow does not run on them. Do not enable CI from this folder.

## peaceful-motors-free-commercial

| Field | Value |
|---|---|
| Source dir | `deploy/commercial-worker/` |
| Hostnames | `peacefulmotors.com`, `www.peacefulmotors.com`, `booking.peacefulmotors.com` (+ zone route `booking.peacefulmotors.com/*`) |
| Production version | `880dba0c-4bde-4d2e-aaf0-67c0bfad9be3` |
| Rollback | `4315c22e-445b-4efc-a628-703dd7303b6c` |
| Manual deploy | See below |

```bash
export PATH=~/.local/node22/bin:$PATH
export CLOUDFLARE_ACCOUNT_ID=b0f16a5aafa1f7a3a3264871c1191565
cd deploy/commercial-worker
npx wrangler versions upload --message "..."
# test preview URL, then:
npx wrangler versions deploy <VERSION>@100% --name peaceful-motors-free-commercial -y
```

**Never** deploy `recovery/site/public` alone. Always use this full bundle (`dist/` + `public/` + `wrangler.json`).

## peaceful-motors-app

| Field | Value |
|---|---|
| Source dir | `deploy/peaceful-motors-app/` |
| Hostnames / routes | `app.peacefulmotors.com/*`, `os.peacefulmotors.com/*`, `beta.peacefulmotors.com/*` |
| Production version | `fda1bb2d-8177-4688-aff9-dbaf21d6eecc` |
| Rollback | `32853771-07aa-4921-ae5c-400927f768c8` (confirm) |
| Manual deploy | Capture noted; no wrangler project file recovered — keep manual until a verified wrangler.json is added |

## peaceful-os-app-router

Source remains `everyone-app/` (not duplicated here). Live `4d8f0612…`; rollback `100b508d…`.
