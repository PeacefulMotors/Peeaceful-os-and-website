-- Restore promote_booking to the 202609150002 definition, then drop additions.
-- Re-apply supabase/migrations/202609150002_booking_customer_vehicle.sql FIRST (it holds the prior function body), then:
drop function if exists public.reconcile_provisional_vehicle(uuid,text);
alter table public.vehicles drop constraint if exists vehicles_vin_status_check;
alter table public.vehicles drop column if exists vin_status;  -- only after confirming no data needs preserving
