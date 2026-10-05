# Owner Inbox deployment
The existing owner-app Edge Function serves the page stored in app_data chunks.
Canonical UI source: page.html. No email transport is implemented.
1. Run: node supabase/tests/build-owner-page.mjs
2. Review and apply functions/owner-app/page.generated.sql to the intended project.
3. Deploy the existing owner-app using index.ts; keep its existing public HTML access.
4. Verify source readback and authenticated office actions.
The browser uses only the publishable key and RLS-protected tables.
Rollback: redeploy supabase/rollbacks/owner-app-before-inbox.ts as index.ts.
Original _oa_v20_* chunks remain intact. Do not delete them during acceptance.
Run tests: node supabase/tests/owner-inbox.mjs and supabase/tests/inbox_foundation_rls.sql.
The SQL test uses temporary fixture records and rolls everything back.
Authenticated browser/iPhone acceptance remains a separate check.
