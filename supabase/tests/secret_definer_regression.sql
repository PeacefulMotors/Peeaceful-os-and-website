BEGIN;
DO $test$
DECLARE id uuid:=gen_random_uuid(); denied boolean; rl text; result text;
BEGIN
 FOREACH rl IN ARRAY ARRAY['','anon','authenticated'] LOOP
  PERFORM set_config('request.jwt.claim.role',rl,true);
  PERFORM set_config('request.jwt.claims',CASE WHEN rl='' THEN '{}' ELSE json_build_object('role',rl)::text END,true);
  denied:=false;BEGIN PERFORM public.get_wave_secret_service(id);EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='service role required';END;ASSERT denied,'secret read requires service role';
  denied:=false;BEGIN PERFORM public.set_wave_secret_service(id,'fixture');EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='service role required';END;ASSERT denied,'secret write requires service role';
  denied:=false;BEGIN PERFORM private.set_integration_secret('TEST:closeout:'||id,'fixture');EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='service role required';END;ASSERT denied,'private secret setter requires service role';
 END LOOP;
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 PERFORM public.set_wave_secret_service(id,'fixture');
 result:=public.get_wave_secret_service(id);ASSERT result='fixture','service role fixture roundtrip';
 PERFORM private.set_integration_secret('TEST:closeout:'||id,'fixture');
 ASSERT NOT has_function_privilege('anon','public.get_wave_secret_service(uuid)','EXECUTE'),'anon grant';
 ASSERT NOT has_function_privilege('authenticated','public.get_wave_secret_service(uuid)','EXECUTE'),'authenticated grant';
END $test$;
ROLLBACK;
SELECT 'PASS: secret DEFINER null/anon/authenticated denied; service fixture roundtrip; rollback' result;
