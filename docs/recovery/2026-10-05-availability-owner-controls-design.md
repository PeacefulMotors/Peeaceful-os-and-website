# Availability owner controls (DRAFT design, not built)

Evidence date: 5 Oct 2026 (ET).

## Backing store

- Key: `public.app_data` row `key = 'booking_windows'` (JSON text).
- Fields used by live `availability` v4:
  - `closed_dates: string[]` (YYYY-MM-DD) — no windows that day
  - `evening_open_dates: string[]` — weekday dates that add `evening_window`
  - `evening_window: "Evening 6:00-8:30"`
  - `known_blocks`, `phases`, `timezone`
- Live values on 5 Oct 2026: `closed_dates: []`, `evening_open_dates: []`.

## Current UI

- `owner-app` v19: no closed/evening date card; no `booking_windows` read/write.
- `booking-command-center` v7: reads `availability` for reschedule only; does not edit config.
- `app_data` has RLS enabled and **zero policies** (advisor `rls_enabled_no_policy`). Authenticated clients cannot SELECT/UPDATE via PostgREST; service_role (edge) can.

## Smallest owner-only control (proposed)

1. New SECURITY DEFINER RPCs (owner/admin only, shop-scoped via `staff.role`):
   - `list_booking_schedule_overrides()` → `{closed_dates, evening_open_dates, evening_window}`
   - `set_booking_schedule_override(p_kind text, p_date date, p_op text)` where kind in (`closed`,`evening_open`) and op in (`add`,`remove`)
2. Body auth: `auth.uid()` + `staff.role in ('owner','admin')` for master/shop; never expose service role to browser.
3. One card in `owner-app`: list upcoming closures and evening opens; date input + Add/Remove; calls the RPCs only (no secrets in frontend).
4. Files/endpoints:
   - Migration: `supabase/migrations/..._booking_schedule_owner_rpcs.sql` (+ rollback + RLS/RPC test)
   - UI: `owner-app` index.ts card section (or `booking-command-center` if preferred for ops)
5. Do not change MX/calendar/transport. Do not rewrite phases from the card.

## Approval needed

Owner sign-off before any migration or owner-app deploy. Not part of inbox draft PR apply path.
