BEGIN;
DO $test$
declare
 shop uuid; t1 uuid:=gen_random_uuid();t2 uuid:=gen_random_uuid();
 v1 uuid:=gen_random_uuid();v2 uuid:=gen_random_uuid();j1 uuid:=gen_random_uuid();j2 uuid:=gen_random_uuid();
 i1 uuid:=gen_random_uuid();n integer;
begin
 select id into shop from public.shops order by id limit 1;
 insert into auth.users(id,email) values(t1,t1::text||'@example.invalid'),(t2,t2::text||'@example.invalid');
 insert into public.staff(user_id,name,role,shop_id) values(t1,'TEST NON-CUSTOMER worker 1','tech',shop),(t2,'TEST NON-CUSTOMER worker 2','tech',shop);
 insert into public.vehicles(id,shop_id,model) values(v1,shop,'TEST vehicle 1'),(v2,shop,'TEST vehicle 2');
 insert into public.jobs(id,shop_id,vehicle_id,assigned_tech,title) values(j1,shop,v1,t1,'TEST NON-CUSTOMER assignment'),(j2,shop,v2,t2,'TEST NON-CUSTOMER assignment');
 insert into public.inspections(id,shop_id,job_id,performed_by,inspection_key) values(i1,shop,j1,t2,'compact_car');
 perform set_config('request.jwt.claim.sub',t1::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.vehicles where id in(v1,v2);
 assert n=1, 'tech must see only assigned vehicle';
 update public.vehicles set odometer=123 where id=v1;
 get diagnostics n=row_count;
 assert n=1, 'tech can update assigned vehicle';
 update public.vehicles set odometer=456 where id=v2;
 get diagnostics n=row_count;
 assert n=0, 'tech cannot update another vehicle';
 update public.jobs set status='in_progress' where id=j1;
 get diagnostics n=row_count;
 assert n=1,'assigned technician progress update must work';
 begin
   update public.jobs set amount_paid=123 where id=j1;
   raise exception 'Technician money mutation was accepted';
 exception when others then
   if SQLERRM not like 'Technician updates are limited%' then raise; end if;
 end;
 select count(*) into n from public.inspections where id=i1;
 assert n=1, 'assigned tech can see inspection';
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',t2::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.inspections where id=i1;
 assert n=0, 'historic performer cannot bypass reassignment';
 execute 'reset role';
end;
$test$;
ROLLBACK;
SELECT 'PASS: assigned vehicle read/update, other vehicle denial, assigned inspection read, historic performer denied after reassignment; fixtures rolled back' result;
