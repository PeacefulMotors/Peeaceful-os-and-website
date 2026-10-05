-- Applied to live project on 2026-10-05 as owner_schedule_execute_hardening.
-- No availability data or authenticated/service-role grants changed.
REVOKE EXECUTE ON FUNCTION public.owner_list_booking_exceptions() FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.owner_set_booking_exception(date,text,boolean) FROM PUBLIC,anon;
