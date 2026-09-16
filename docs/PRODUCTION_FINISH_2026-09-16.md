# Production finish verification — 2026-09-16

Agent: Grok. Packet: Peaceful OS — Production Finish Prompt.
No Cloudflare route write, no Auth toggle, no RLS policy write, no webhook secret rotation, no production restore.

## P0-1 Six subdomains
Live headed-browser + curl check. All six return HTTP 200 `text/html` and render UI, not raw source.

| Host | Title / UI |
|---|---|
| inspect.peacefulmotors.com | Peaceful Inspect |
| tech.peacefulmotors.com | Technician sign in |
| customer.peacefulmotors.com | Peaceful Motors Customer |
| schedule.peacefulmotors.com | Peaceful Scheduler sign in |
| customers.peacefulmotors.com | Peaceful Motors Customer Database |
| contacts.peacefulmotors.com | Peaceful Motors Customer Database |

owner.peacefulmotors.com also live (Peaceful OS Owner).

GitHub Actions `Deploy Peaceful OS App Router` last 5 runs failed at **Check required Cloudflare secrets**. Live routing exists outside that failed CI path. Latest failed run: https://github.com/PeacefulMotors/Peeaceful-os-and-website/actions/runs/33224301256

## P0-2 European labor rate
Live https://peacefulmotors.com/prices shows European **$175/hr**.
No redeploy was triggered this session.

Drift vs repo `recovery/site/public/prices.html`:
- Live diesel after hours $250 / exotic $260
- Repo file diesel after hours $265 / exotic $275
Public pricing is still a static bundle. Future `peaceful_rate_card` edits will not show until the Worker asset bundle is rebuilt.

## P0-3 Leaked password protection
Not changed. No Supabase Auth Management API in this session.
Owner path: Supabase Dashboard → Authentication → Password security → enable Leaked password protection.

## Also-open
- Stripe live: enabled `we_1U6eZFGfDywknrUDbOyUebwD` → `https://xsqjskbcmsjzkumbsrti.supabase.co/functions/v1/stripe-subscription-webhook` (9 events). Superseded twin disabled. Function verifies Stripe-Signature against `get_integration_secret('stripe_webhook_secret_v2')`. Secrets not rotated.
- Backup/restore drill not run.
- No policies written on app_data, inspector_applications, training_question_bank, video_quiz_questions.

## Owner actions still required
1. Enable leaked-password protection.
2. Set GitHub Actions secrets CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID on this repo.
3. Take a Supabase backup (do not restore production).
4. State intended API access for the four RLS-on / zero-policy tables before any policy is added.
