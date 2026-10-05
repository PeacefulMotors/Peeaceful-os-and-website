-- Authorization matrix for public.reconcile_provisional_vehicle (SECURITY DEFINER, internal auth check).
-- Run in a transaction and ROLLBACK. Verified PASS 2026-10-04 against production schema (rolled back).
-- Cases: owner/admin/service_writer allowed; technician denied; cross-shop denied; non-staff denied;
-- anonymous denied; service_role allowed; VIN already owned elsewhere -> conflict_requires_review, no merge.
-- (Body identical to the verified run; uses the single existing staff row and restores nothing because it ROLLBACKs.)
BEGIN;
DO $test$
declare
 shop uuid; uid uuid; v uuid; r jsonb; roles text[]:=array['owner','admin','service_writer'];
 rl text; vinA text:='TEST'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,13));
 vinB text:='TEST'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,13)); ok boolean; i int:=0;
begin
 select id into shop from public.shops order by id limit 1;
 select user_id into uid from public.staff where shop_id=shop::text limit 1;
 assert uid is not null, 'need a staff fixture row';
 perform set_config('request.jwt.claims', json_build_object('sub',uid,'role','authenticated')::text, true);
 perform set_config('request.jwt.claim.sub', uid::text, true);
 perform set_config('request.jwt.claim.role','authenticated', true);
 foreach rl in array roles loop
   i:=i+1; update public.staff set role=rl where user_id=uid;
   insert into public.vehicles(shop_id,year,make,model,external_ref,vin_status) values(shop,2020,'TEST','R'||i,'TEST-AUTH-'||gen_random_uuid(),'unverified') returning id into v;
   r:=public.reconcile_provisional_vehicle(v,'TEST'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,13)));
   assert r->>'status'='reconciled', rl||' must be allowed';
 end loop;
 update public.staff set role='tech' where user_id=uid;
 insert into public.vehicles(shop_id,year,make,model,external_ref,vin_status) values(shop,2020,'TEST','T','TEST-AUTH-'||gen_random_uuid(),'unverified') returning id into v;
 ok:=false; begin perform public.reconcile_provisional_vehicle(v,vinA); exception when others then ok:=sqlerrm like 'Not authorized%'; end; assert ok,'technician must be denied';
 update public.staff set role='owner', shop_id=gen_random_uuid()::text where user_id=uid;
 ok:=false; begin perform public.reconcile_provisional_vehicle(v,vinA); exception when others then ok:=sqlerrm like 'Not authorized%'; end; assert ok,'cross-shop must be denied';
 perform set_config('request.jwt.claims', json_build_object('sub',gen_random_uuid(),'role','authenticated')::text, true);
 perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
 ok:=false; begin perform public.reconcile_provisional_vehicle(v,vinA); exception when others then ok:=sqlerrm like 'Not authorized%'; end; assert ok,'non-staff must be denied';
 perform set_config('request.jwt.claims','{}',true); perform set_config('request.jwt.claim.sub','',true); perform set_config('request.jwt.claim.role','',true);
 ok:=false; begin perform public.reconcile_provisional_vehicle(v,vinA); exception when others then ok:=sqlerrm like 'Not authorized%'; end; assert ok,'anonymous must be denied';
 perform set_config('request.jwt.claims','{"role":"service_role"}',true); perform set_config('request.jwt.claim.role','service_role',true);
 insert into public.vehicles(shop_id,year,make,model,vin,vin_status,external_ref) values(shop,2018,'TEST','OWN',vinB,'provided','TEST-AUTH-'||gen_random_uuid());
 r:=public.reconcile_provisional_vehicle(v,vinB);
 assert r->>'status'='conflict_requires_review' and (select vin is null from public.vehicles where id=v),'conflict must not merge';
 r:=public.reconcile_provisional_vehicle(v,vinA); assert r->>'status'='reconciled','service_role must be allowed';
end $test$;
ROLLBACK;
