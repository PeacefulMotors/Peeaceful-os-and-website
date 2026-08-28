# Claude handoff — finish Peaceful OS Cloudflare production connection

You are finishing the production edge connection for Peaceful Motors. Do not redesign the apps. Do not create duplicate databases. Do not move data away from Supabase. Do not introduce paid hosting unless technically unavoidable and explicitly approved.

## Canonical architecture
- Domain/DNS/edge: Cloudflare
- App/data/auth: Supabase project `xsqjskbcmsjzkumbsrti`
- Source control: GitHub repo `PeacefulMotors/Peeaceful-os-and-website`
- Payments: Stripe
- Notion is the operating brain/spec, not the transactional database.

## Already prepared in GitHub
- `everyone-app/worker.js`
- `everyone-app/wrangler.jsonc`
- `.github/workflows/deploy-cloudflare-app-router.yml`

The Worker is a single free-first edge router that maps these custom domains to existing live Supabase functions:

| Host | Supabase function |
|---|---|
| inspect.peacefulmotors.com | inspect |
| owner.peacefulmotors.com | owner-app |
| tech.peacefulmotors.com | tech-app |
| customer.peacefulmotors.com | customer-app |
| book.peacefulmotors.com | booking-page |
| schedule.peacefulmotors.com | scheduler |
| customers.peacefulmotors.com | customer-database-app |
| beta.peacefulmotors.com | peaceful-tools |

## Your job
1. Open the connected Cloudflare account that owns `peacefulmotors.com`.
2. Verify the zone is active and authoritative. Do not change nameservers unless the zone is not actually delegated to Cloudflare and the owner explicitly approves that correction.
3. Create a scoped Cloudflare API token for Workers deployment if one does not already exist. Minimum required permissions only. Never print or commit the token.
4. Add GitHub repository secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   Do not put either value in source files, Notion, logs, screenshots, or chat.
5. From the repository root, inspect `everyone-app/wrangler.jsonc` and `everyone-app/worker.js`. Preserve the existing mappings unless a function is proven wrong.
6. Run a Wrangler dry-run/validation first. Fix syntax/config only. Do not redesign app code.
7. Deploy `peaceful-os-app-router` to Cloudflare Workers.
8. Ensure all eight `custom_domain` routes are attached to the `peacefulmotors.com` zone and Cloudflare provisions HTTPS certificates.
9. If a hostname already has an A/AAAA/CNAME record that conflicts with the Worker custom domain, inspect what it serves before changing it. Preserve the current main website. Only replace records for the eight app hostnames listed above when needed.
10. Do NOT point `peacefulmotors.com` or `www.peacefulmotors.com` at this app router. The main website is separate.
11. Test each hostname on HTTPS from a clean browser session and record response status and final URL.
12. Test mobile Safari dimensions and desktop Chrome. Confirm no horizontal overflow or broken modal behavior.
13. Verify auth/RLS behavior:
    - customer sees only their own customer/vehicle/job/estimate data;
    - technician sees only assigned/permitted work;
    - owner/admin sees shop administration;
    - customer database requires staff auth;
    - no anonymous endpoint exposes private customer/shop records.
14. Test booking once with a clearly marked test customer and confirm it creates exactly one booking and does not duplicate customer/vehicle/job records.
15. Test inspection once with a clearly marked test vehicle/job and confirm findings/report flow works.
16. Do not run live Stripe charges. Use test mode for payment/subscription verification.
17. Preserve Supabase as source of truth. The Cloudflare Worker is the branded edge/front door, not a second database.
18. Keep the deployment free-first. One Worker is preferred over separate Workers for every role app.
19. If Cloudflare rejects `custom_domain` routes, diagnose the exact account/zone/token error and fix only that problem. Do not fall back to WordPress, Vercel, Netlify, or a paid platform.
20. Once all tests pass, update the Notion page `Peaceful OS Beta Program — Customer + Technician + Owner Testing` with:
    - deployed Worker name;
    - deployment timestamp;
    - each live HTTPS URL;
    - test result for each URL;
    - Git commit SHA deployed;
    - unresolved issues, if any.

## Required final URLs
- https://inspect.peacefulmotors.com
- https://owner.peacefulmotors.com
- https://tech.peacefulmotors.com
- https://customer.peacefulmotors.com
- https://book.peacefulmotors.com
- https://schedule.peacefulmotors.com
- https://customers.peacefulmotors.com
- https://beta.peacefulmotors.com

## Hard rules
- No WordPress for these apps.
- No duplicate Supabase project.
- No duplicate customer database.
- No paid hosting purchase without owner approval.
- No secrets in source or chat.
- No copying proprietary Identifix/PartsTech/OEM datasets or UI assets.
- Do not claim LIVE until DNS, HTTPS, auth/RLS, and fresh-device smoke tests pass.

Return a concise deployment report with PASS/FAIL for every hostname and the exact blocker for any failure.
