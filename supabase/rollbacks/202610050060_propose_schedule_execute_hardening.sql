-- Restore the exact previously observed explicit anon grants; PUBLIC had none.
GRANT EXECUTE ON FUNCTION public.owner_list_booking_exceptions() TO anon;
GRANT EXECUTE ON FUNCTION public.owner_set_booking_exception(date,text,boolean) TO anon;
