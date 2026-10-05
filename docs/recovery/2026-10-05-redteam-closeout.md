# Red-team closeout — Cloudflare (5 Oct 2026 ET)

## peaceful-motors-free-commercial
| Step | Version | Rollback |
|---|---|---|
| Baseline (booking v2) | `3bb576e8-d1e7-4ab4-8211-4f552cb0a7ca` | `688aa484-e8b5-4084-a5e0-5169a92a8e58` |
| /academy 308 redirect | `af3c3512-f0fe-47f3-a5d2-3d916f9ca49a` | `3bb576e8...` |
| Public cleanup (live) | `4315c22e-445b-4efc-a628-703dd7303b6c` | `af3c3512...` |

Full bundle: `docs/recovery/2026-10-05-commercial/`.

## peaceful-os-app-router
Live `4d8f0612-3232-4f99-ae7b-e207721d9114` (100%). Rollback `100b508d-4dfc-4d1a-8778-28750a8f235a`. Source in `everyone-app/` (synced via PR #5).

## peaceful-motors-app
Live `fda1bb2d-8177-4688-aff9-dbaf21d6eecc` (since 1 Sep 2026). No repo source path found. Keep manual.

## Stale
Worker `peeaceful-os-and-website` (Aug 3 template) and Pages project `peaceful-os` — do not delete without Frederick's approval; not on production hostnames for the public site.
