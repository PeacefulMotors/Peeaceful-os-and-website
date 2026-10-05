-- PROPOSED ONLY. Does not change booking_windows or authenticated/service-role grants.
REVOKE EXECUTE ON FUNCTION public.owner_list_booking_exceptions() FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.owner_set_booking_exception(date,text,boolean) FROM PUBLIC,anon;
