# Peaceful OS Shop Suite Closeout — execution packet — 2026-09-01

## Current verified state
- Production architecture: Cloudflare + Supabase.
- `peacefulmotors.com` -> Cloudflare Worker `peaceful-motors-free-commercial`.
- `app.peacefulmotors.com`, `os.peacefulmotors.com`, `beta.peacefulmotors.com` -> Cloudflare Worker `peaceful-motors-app`.
- `inspect.peacefulmotors.com` -> Cloudflare Worker `peaceful-os-app-router` -> Supabase Edge Function `inspect`.
- `owner.`, `tech.`, `customer.`, `booking.`, `schedule.`, `customers.`, `contacts.`, `academy.` are mapped by the existing `peaceful-os-app-router` source to their Supabase Edge Functions.
- Supabase Auth Site URL has been corrected from localhost to `https://app.peacefulmotors.com`.
- Current Redirect URL allow-list is the exact supported hub target `https://app.peacefulmotors.com/`.
- Live `inspect` source is recovered: v29, function ID `35950c17-78fa-44d6-a75d-b5df948a4ee2`, bundle SHA-256 `1d8acddec38be1c583b74717edb3e89913e0cd2b991161b46d5a351e2a0ed30e`.
- `peaceful-site` Supabase function v4 contains the approved compact Peaceful Motors public redesign, but it is NOT the apex serving Worker.
- `peaceful-os-public` Supabase function v5 contains the simplified Beta door page, but it is NOT the `beta.` serving Worker.
- GitHub public-site design source: `docs/P0_SITE_REDO_2026-09-01.md`.

## Locked operating rules
- Cloudflare + Supabase for commercial/customer/shop production.
- Vercel only for non-commercial preview, legacy, internal experiment, or a non-system-of-record surface. Never use it for production booking, payment, customer auth, shop data, or a second commercial truth.
- Peaceful Red `#4A0506`, Wheel Gray `#969696`, Ink `#000000`, Accent Green `#546B50`, White.
- POSTED PRICES governs.
- QUEUE, NEVER SEND.
- No fake production customers.
- Estimate and invoice sequences remain independent, numeric, sequential, and never reused.
- Do not delete or corrupt real production records, including Christopher Jones booking ref `8431265C` and invoice `1123`.
- No raw Supabase Edge Function URLs in final product navigation.
- No new app when a repair/consolidation solves the problem.

## P0 order
1. Reconcile and retrieve deployed source for `peaceful-motors-free-commercial`.
2. Apply the approved public redesign to that actual Worker, preserving `/services`, `/prices`, `/explore`, `/policies`, `/book`, legal pages, Stripe/server-side behavior, and correct POSTED PRICES.
3. Reconcile and retrieve deployed source for `peaceful-motors-app`.
4. Make `app.` the canonical staff front door; `beta.` the acceptance host for the same real application and data; `os.` same real app or redirect. Remove duplicate/multi-page/demo behavior. Never blue shell.
5. Verify branded `owner.`, `tech.`, `customer.` routes and role isolation through `peaceful-os-app-router` to current Supabase functions.
6. Implement Inspect password recovery in recovered live source. Add an exact Auth redirect URL only when the code requests that path. Test iPhone Mail -> Safari -> set password -> correct role.
7. Scoped MIME tests and correction only where failing.
8. Run production TEST-job photo persistence proof.
9. Integrate Quick Estimate and Owner assignment work already completed; do not rebuild them.
10. Close money loops: booking -> Stripe verified webhook -> Calendar -> job; estimate -> authorization -> RO -> invoice -> payment reconciliation.
11. Academy after money loop and role access are stable.

## Evidence required before PASS
For each production host record:
- hostname
- Cloudflare Worker / custom domain / route
- Worker Version ID + Deployment ID + deployment source
- upstream Supabase function, if any
- content-type for page and API call
- source SHA / Git commit
- real iPhone result
- VERIFIED / PARTIAL / FAILED / BLOCKED / UNTESTED

A source commit or 200 response alone is not PASS.

## CLAUDE role
Claude is reconciliation architect and live-dashboard verifier. Use live Cloudflare/Supabase evidence to locate the exact deployed source and configuration. Claude should not redesign products or create new architecture. Output the smallest scoped code/deployment plan with rollback evidence.

## GROK role
Grok is deep research, browser, red-team, and connector reconnaissance. First enumerate which connected tools are actually available in that Grok session. Use all relevant read-only capabilities to inspect Cloudflare, Supabase, GitHub, public DNS/HTTP, browser behavior, Stripe docs/config shape, Google Calendar integration requirements, security headers, and competitor workflow evidence. Grok does not override canon and does not deploy production unless the owner explicitly assigns a specific safe action and Grok has the correct connector.

Grok must actively look for:
- dashboard-vs-Git source drift
- stale Cloudflare cached assets
- dead routes and duplicate app shells
- broken buttons and wrong redirects
- auth callback and recovery mismatches
- role/RLS escape paths
- booking/payment/calendar reconciliation failures
- public price/warranty drift
- hidden raw Supabase/Vercel links
- anything preventing a real customer from booking and paying today

Every Grok finding must be classified VERIFIED / LIKELY / POSSIBLE / UNSUPPORTED and include evidence plus the exact next verifier.

## CODEX role
Codex is implementation engineer. Work only from reconciled source. Do not recreate apps, change architecture, or rewrite business rules. Make the smallest change that closes the first open P0 gate, run tests, deploy only through the proven production path, then return evidence.

## Definition of done
A real phone can:
1. open the public site
2. book the correct service lane
3. complete the $50 hold where required
4. create one booking/job in Supabase
5. create one matching Google Calendar event
6. show the same job to Owner
7. assign it to the correct Tech/Inspector
8. complete inspection/media
9. create a correct estimate
10. authorize without re-entry
11. convert to RO
12. create a separate invoice number
13. reconcile payment
14. show receipt/history to customer

No Notion or ChatGPT bridge is required during that workflow.
