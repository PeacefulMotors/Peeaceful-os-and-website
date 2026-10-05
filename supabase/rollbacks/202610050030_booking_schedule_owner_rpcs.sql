-- Rollback booking schedule owner RPCs
DROP FUNCTION IF EXISTS public.owner_set_booking_exception(date, text, boolean);
DROP FUNCTION IF EXISTS public.owner_list_booking_exceptions();
