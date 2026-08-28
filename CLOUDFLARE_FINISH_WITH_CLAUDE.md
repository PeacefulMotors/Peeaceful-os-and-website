# Claude handoff — finish Peaceful OS Cloudflare production connection

You are finishing the production edge connection for Peaceful Motors. Do not redesign the apps. Do not create duplicate databases. Do not move data away from Supabase. Do not introduce paid hosting unless technically unavoidable and explicitly approved.

## Canonical architecture
- Domain/DNS/edge: Cloudflare
- App/data/auth: Supabase project `xsqjskbcmsjzkumbsrti`
- Source control: GitHub repo `PeacefulMotors/Peeaceful-os-and-website`
- Payments: Stripe
- Notion is the operating brain/spec, not the transactional database.

## NON-DESTRUCTIVE ROUTE DECISION — AUG 28 2026
The live route audit found real conflicts. Preserve working hostnames instead of overwriting them.

DO NOT CHANGE OR BIND THIS NEW ROUTER TO:
- `peacefulmotors.com` or `www.peacefulmotors.com` — live marketing site.
- `peacefulmotors.com/book` — current public Peaceful Motors booking form.
- `app.peacefulmotors.com` — existing staff app surface.
- `os.peacefulmotors.com` — existing app surface pending visual confirmation.
- `beta.peacefulmotors.com` — existing beta/app host and referenced by the live public Worker.
- `book.peacefulmotors.com` — current staff-used internal Contact Book. Preserve it until a deliberate migration is approved.

The new Worker router is only for new or currently-unresolved hostnames:

| Host | Supabase function | Purpose |
|---|---|---|
| inspect.peacefulmotors.com | inspect | Inspection app |
| owner.peacefulmotors.com | owner-app | Owner/admin app |
| tech.peacefulmotors.com | tech-app | Technician app |
| customer.peacefulmotors.com | customer-app | Customer portal |
| booking.peacefulmotors.com | booking-page | Standalone booking app for future external/shop subscription use |
| schedule.peacefulmotors.com | scheduler | Scheduler app |
| customers.peacefulmotors.com | customer-database-app | Customer database app |
| contacts.peacefulmotors.com | customer-database-app | Canon-compatible alias for customer/contact database |
| academy.peacefulmotors.com | shop-app-academy | Training/academy app |

`customers.` and `contacts.` intentionally point to the same canonical customer/contact database app. They do not create duplicate data.

## Already prepared in GitHub
- `everyone-app/worker.js`
- `everyone-app/wrangler.jsonc`
- `.github/workflows/deploy-cloudflare-app-router.yml`

## Your job
1. Open the connected Cloudflare account that owns `peacefulmotors.com`.
2. Verify the zone is active and authoritative. Do not change nameservers unless the zone is not delegated to Cloudflare and the owner explicitly approves that correction.
3. Create/use a scoped Cloudflare API token for Workers deployment. Minimum required permissions only. Never print or commit the token.
4. Add GitHub repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` directly in GitHub if permitted. Never put either value in source, Notion, logs, screenshots, or chat.
5. Inspect `everyone-app/wrangler.jsonc` and `everyone-app/worker.js`. Use the current GitHub version as canonical for this router.
6. Run Wrangler validation/dry-run first. Fix syntax/config only.
7. Deploy `peaceful-os-app-router` to Cloudflare Workers.
8. Attach only the new non-destructive custom domains listed above. Provision HTTPS.
9. Before touching any existing DNS record, inspect what it currently serves. Do not overwrite a working hostname merely because an older document uses the same name.
10. Do not bind this router to root/www/app/os/beta/book.
11. Test each new hostname from a clean browser and record status/final URL.
12. Test mobile Safari dimensions and desktop Chrome. Confirm no horizontal overflow or broken modal behavior.
13. Verify auth/RLS behavior: customer sees only their own records; technician only assigned/permitted work; owner/admin shop administration; customer database requires staff auth; anonymous access exposes no private records.
14. Test one clearly-marked booking and confirm exactly one booking with no duplicate customer/vehicle/job records.
15. Test one clearly-marked inspection and confirm VIN/odometer/findings/report flow.
16. Do not run live Stripe charges. Use test mode.
17. Preserve Supabase as source of truth. Cloudflare is branded edge/front door only.
18. Keep deployment free-first. One Worker is preferred over separate Workers for every role app.
19. If Cloudflare rejects a custom domain, report the exact token/zone/account/DNS error and fix only that issue. Do not fall back to WordPress, Vercel, Netlify, or paid hosting.
20. Update the Notion pages `Peaceful OS - finish and launch checklist` and `Peaceful OS Beta Program — Customer + Technician + Owner Testing` with deployed Worker name, timestamp, live URLs, PASS/FAIL per URL, deployed commit SHA, and unresolved issues.

## Required new URLs
- https://inspect.peacefulmotors.com
- https://owner.peacefulmotors.com
- https://tech.peacefulmotors.com
- https://customer.peacefulmotors.com
- https://booking.peacefulmotors.com
- https://schedule.peacefulmotors.com
- https://customers.peacefulmotors.com
- https://contacts.peacefulmotors.com
- https://academy.peacefulmotors.com

## Existing URLs to preserve
- https://peacefulmotors.com
- https://peacefulmotors.com/book
- https://app.peacefulmotors.com
- https://os.peacefulmotors.com
- https://beta.peacefulmotors.com
- https://book.peacefulmotors.com

## Hard rules
- No WordPress for these apps.
- No duplicate Supabase project.
- No duplicate customer database.
- No paid hosting purchase without owner approval.
- No secrets in source or chat.
- No copying proprietary Identifix/PartsTech/OEM datasets or UI assets.
- Do not claim LIVE until DNS, HTTPS, auth/RLS, and fresh-device smoke tests pass.

Return a concise deployment report with PASS/FAIL for every new hostname and the exact blocker for any failure.
