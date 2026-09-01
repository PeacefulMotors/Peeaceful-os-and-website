# Live Inspect source evidence — 2026-09-01

Recovered directly from Supabase project `xsqjskbcmsjzkumbsrti`.

- Function: `inspect`
- Function ID: `35950c17-78fa-44d6-a75d-b5df948a4ee2`
- Live version: `29`
- Status: `ACTIVE`
- `verify_jwt`: `false` (preserve until function-level auth behavior is deliberately reviewed; do not silently flip it)
- Supabase bundle SHA-256: `1d8acddec38be1c583b74717edb3e89913e0cd2b991161b46d5a351e2a0ed30e`

Verified from live source:
- Login is handled through the function API and Supabase Auth.
- `resetPass()` posts to `/auth/v1/recover` with `{email}` only; it does not send a production `redirectTo` and has no password-update landing flow.
- The live page still contains navy/blue CSS variables and conflicts with current Peaceful Red canon.
- Photo persistence logic uploads inspection evidence to `job-photos` and writes rows to `job_photos` tied to the real shop/job/inspection.
- Owner assignment API exists in the live function and is owner-gated.

This file is rollback/reconciliation evidence. The actual `index.ts` must be copied from the live Supabase function before editing and its SHA compared to the value above. Do not recreate Inspect from a shell.