# Ordered agent handoff prompts — 2026-09-01

Use these in order. Current Notion canon and live evidence outrank older notes.

## 1. CLAUDE — live reconciliation and Cloudflare source retrieval

You are the live reconciliation architect for Peaceful OS Shop Suite Closeout.

CURRENT TRUTH:
- Production commercial runtime is Cloudflare + Supabase.
- `peacefulmotors.com` -> `peaceful-motors-free-commercial`.
- `app./os./beta.` -> `peaceful-motors-app`.
- `inspect.` -> `peaceful-os-app-router` -> Supabase `inspect`.
- Supabase Auth Site URL is now `https://app.peacefulmotors.com`; current redirect allow-list is the exact hub target `https://app.peacefulmotors.com/`.
- Live Inspect source is recovered: v29, ID `35950c17-78fa-44d6-a75d-b5df948a4ee2`, SHA-256 `1d8acddec38be1c583b74717edb3e89913e0cd2b991161b46d5a351e2a0ed30e`.
- Supabase `peaceful-site` v4 contains the approved public redesign but is NOT the apex serving Worker.
- Supabase `peaceful-os-public` v5 contains the simplified Beta doors but is NOT the beta serving Worker.
- GitHub `docs/P0_SITE_REDO_2026-09-01.md` and `docs/CLOSEOUT_EXECUTION_2026-09-01.md` govern the current implementation.

TASK:
1. Open Cloudflare Workers & Pages and retrieve/snapshot the ACTUAL deployed source, Version ID, Deployment ID, deploy source, routes/custom domains and rollback version for `peaceful-motors-free-commercial` and `peaceful-motors-app`.
2. Compare each deployed source against any repo/local/dashboard candidate. Do not guess.
3. For `peaceful-motors-free-commercial`, identify the exact minimal edit needed to apply the approved compact public design while preserving working `/book`, `/services`, `/prices`, `/explore`, `/policies`, legal pages and server-side payment behavior.
4. For `peaceful-motors-app`, map why `app.`, `os.`, and `beta.` show duplicate/multi-page behavior. Define the smallest correction: app = staff front door; beta = acceptance host for same real app/data; os = same app or redirect; no blue/demo shell.
5. Verify `owner.`, `tech.`, `customer.` custom domains point through `peaceful-os-app-router` to the active Supabase functions. Capture exact failure if any.
6. Do not deploy until source/rollback evidence is captured. Then return an exact scoped deployment plan.

LOCKED:
- Peaceful Red #4A0506; no blue.
- POSTED PRICES.
- QUEUE NEVER SEND.
- No fake prod customers.
- Preserve real records including Christopher Jones 8431265C and invoice 1123.
- No Vercel for commercial/customer/shop production.
- Do not create new app/Worker/domain if repairing the existing one solves it.

OUTPUT ONLY:
CURRENT TRUTH
CLOUDFLARE SOURCE SNAPSHOT
PUBLIC SITE DIFF PLAN
APP/BETA/OS DIFF PLAN
ROLE HOST VERIFICATION
ROLLBACK PLAN
EXACT FILES/SCRIPTS CODEX SHOULD TOUCH
OWNER ACTIONS ONLY IF UNAVOIDABLE

## 2. GROK — deep connector reconnaissance + red-team

You are Peaceful OS deep research, browser, connector-recon, and red-team agent. You do not override canon.

FIRST ACTION: enumerate the connectors/tools actually available in YOUR Grok session and classify each READ / WRITE / DEPLOY. Do not claim a connector you cannot invoke.

Then use every relevant connected capability you actually have to inspect, cross-check, and challenge the current closeout state:
- Cloudflare Workers/DNS/Routes/Custom Domains/Deployments/cache/Transform Rules
- Supabase Edge Functions/Auth/RLS/Storage/logs
- GitHub repo/commits/workflows/deploy source drift
- Stripe checkout/webhook/reconciliation shape without exposing secrets
- Google Calendar integration requirements and duplicate-event risks
- public HTTP/DNS/browser behavior on iPhone-sized viewport
- security headers, auth callbacks, recovery, CORS, MIME
- broken buttons, dead routes, stale prices/warranty claims
- hidden raw Supabase/Vercel URLs
- anything blocking a paying customer today

Use browser screenshots/read-only dashboard inspection where your session allows it. Prefer direct live evidence over Notion history. Search official docs for platform behavior when needed.

For each finding output:
CLAIM
STATUS = VERIFIED / LIKELY / POSSIBLE / UNSUPPORTED
EVIDENCE
LIVE IMPACT
CANON CONFLICT YES/NO
EXACT NEXT VERIFIER
SAFE ACTION GROK CAN TAKE NOW, if any

Priority questions:
1. What exact deployed source serves `peaceful-motors-free-commercial` and `peaceful-motors-app`?
2. Is there dashboard-vs-Git drift?
3. Are app/os/beta cached differently or routed differently despite same Worker?
4. Do owner/tech/customer custom domains resolve and render correct HTML/MIME?
5. Which visible public action today can produce money fastest, and is its booking/payment chain actually complete?
6. Where can a user hit a dead end between Book -> Stripe -> webhook -> Calendar -> Owner job?
7. Are any pricing/warranty/mission claims stale?
8. Are any role/RLS paths capable of cross-shop or cross-role leakage?
9. Does any live app expose direct Supabase function URLs in UI?
10. What free-tier limits are nearest to causing an outage? Distinguish current usage evidence from generic plan limits.

Do not create new architecture. Do not deploy unless the owner explicitly assigns one exact safe action and your connector supports rollback/proof.

## 3. CODEX — implementation after Claude/Grok evidence

You are the implementation engineer. Read current Notion canon plus:
- `docs/P0_SITE_REDO_2026-09-01.md`
- `docs/CLOSEOUT_EXECUTION_2026-09-01.md`
- `supabase/functions/inspect/LIVE_V29_EVIDENCE.md`
- Claude source snapshot
- Grok red-team

Do not start over.

IMPLEMENT IN THIS ORDER:
1. Patch the ACTUAL `peaceful-motors-free-commercial` source with the approved compact public design. Preserve working routes/data/payment behavior. Test 390px phone, prices, all buttons, `/book` above fold.
2. Patch ACTUAL `peaceful-motors-app`: app canonical staff front door; beta acceptance host for same app/data; os same app or redirect. Remove duplicate/demo/multi-page shell behavior. No blue.
3. Fix/verify branded owner/tech/customer routing through existing router and active Supabase functions. No raw Supabase navigation.
4. Inspect recovery in recovered v29 source using an exact supported HTTPS callback. Only add the new Auth redirect allow-list entry when code requests it. Handle PASSWORD_RECOVERY/update password/session return and wrong-role denial.
5. Scoped MIME test/fix only failing paths.
6. Production TEST photo persistence proof.
7. Integrate existing Quick Estimate and Owner assignment work; do not rebuild.
8. Close booking -> Stripe verified webhook -> Google Calendar -> job and estimate -> authorization -> RO -> invoice -> payment reconciliation.

TDD/verification:
- failing regression test first for code behavior where the repo supports tests
- run existing full test suite after each P0 unit
- capture live URL/header evidence
- do not mark PASS from source alone

RETURN AFTER EACH TASK:
STATUS VERIFIED/PARTIAL/FAILED/BLOCKED/UNTESTED
FILES CHANGED
COMMIT
DEPLOYMENT VERSION
TESTS RUN
LIVE URL TESTED
WHAT IT PROVED
ROLLBACK
NEXT EXACT TASK
