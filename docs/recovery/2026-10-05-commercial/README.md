# peaceful-motors-free-commercial — full production bundle (5 Oct 2026)

**Use this full bundle for deploys.** Do NOT deploy `recovery/site/public` alone.

- Worker version live: `4315c22e-445b-4efc-a628-703dd7303b6c` (100%)
- Prior academy-only version: `af3c3512-f0fe-47f3-a5d2-3d916f9ca49a`
- Booking-v2 baseline (before academy redirect): `3bb576e8-d1e7-4ab4-8211-4f552cb0a7ca`
- Rollback of today's academy redirect: `wrangler versions deploy 3bb576e8-d1e7-4ab4-8211-4f552cb0a7ca@100% --name peaceful-motors-free-commercial -y`
- Rollback of today's public cleanup only: `wrangler versions deploy af3c3512-f0fe-47f3-a5d2-3d916f9ca49a@100% --name peaceful-motors-free-commercial -y`

## Changes vs 3bb576e8
1. `/academy` and `/academy/` → 308 to `https://academy.peacefulmotors.com/` (worker only).
2. Sitemap adds `/dashkit`.
3. Dash Cams nav on Services, Explore, contact, and legal pages (same markup as Home).
4. `--green` `#2e7d32` → `#256b29` for eyebrow contrast.

## Deploy method (manual)
```bash
export PATH=~/.local/node22/bin:$PATH
export CLOUDFLARE_ACCOUNT_ID=b0f16a5aafa1f7a3a3264871c1191565
cd docs/recovery/2026-10-05-commercial
npx wrangler versions upload --message "..."
npx wrangler versions deploy <VERSION>@100% --name peaceful-motors-free-commercial -y
```
No CI workflow watches these paths. Keep deploys manual.
