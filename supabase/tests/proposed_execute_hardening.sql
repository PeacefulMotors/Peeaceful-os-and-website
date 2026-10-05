BEGIN;
-- PROPOSED ONLY. Apply after the missing Cloudflare runtime caller audit closes.
REVOKE EXECUTE ON FUNCTION public.create_my_shop(text,text) FROM PUBLIC,anon,authenticated;
-- PROPOSED ONLY. Does not change booking_windows or authenticated/service-role grants.
REVOKE EXECUTE ON FUNCTION public.owner_list_booking_exceptions() FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.owner_set_booking_exception(date,text,boolean) FROM PUBLIC,anon;

DO $$ BEGIN
 ASSERT NOT has_function_privilege('anon','public.create_my_shop(text,text)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public.create_my_shop(text,text)','EXECUTE');
 ASSERT NOT has_function_privilege('anon','public.owner_list_booking_exceptions()','EXECUTE');
 ASSERT NOT has_function_privilege('anon','public.owner_set_booking_exception(date,text,boolean)','EXECUTE');
 ASSERT has_function_privilege('authenticated','public.owner_list_booking_exceptions()','EXECUTE');
 ASSERT has_function_privilege('authenticated','public.owner_set_booking_exception(date,text,boolean)','EXECUTE');
 ASSERT has_function_privilege('service_role','public.create_my_shop(text,text)','EXECUTE');
END $$;
GRANT EXECUTE ON FUNCTION public.create_my_shop(text,text) TO authenticated;
-- Restore the exact previously observed explicit anon grants; PUBLIC had none.
GRANT EXECUTE ON FUNCTION public.owner_list_booking_exceptions() TO anon;
GRANT EXECUTE ON FUNCTION public.owner_set_booking_exception(date,text,boolean) TO anon;

DO $$ BEGIN
 ASSERT has_function_privilege('authenticated','public.create_my_shop(text,text)','EXECUTE');
 ASSERT has_function_privilege('anon','public.owner_list_booking_exceptions()','EXECUTE');
END $$;
ROLLBACK;
SELECT 'PASS: proposed grants hardening and rollback; live grants unchanged' result;
