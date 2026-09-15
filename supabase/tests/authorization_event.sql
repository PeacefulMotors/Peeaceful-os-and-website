BEGIN;
DO $test$
declare u uuid:=gen_random_uuid();c uuid:=gen_random_uuid();j uuid:=gen_random_uuid();
 e uuid:=gen_random_uuid();s uuid;r boolean;
begin
 select id into s from public.shops order by id limit 1;
 insert into auth.users(id,email) values(u,u::text||'@example.invalid');
 insert into public.customers(id,shop_id,name,notify_ok) values(c,s,'TEST NON-CUSTOMER authorization',false);
 update public.profiles set customer_id=c where user_id=u;
 insert into public.jobs(id,shop_id,customer_id,status,grand_total) values(j,s,c,'estimate',123);
 insert into public.estimates(id,job_id,shop_id,total) values(e,j,s,123);
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 r:=false;
 begin
 insert into public.customer_authorizations(shop_id,customer_id,job_id,estimate_id,typed_name,statement,accepted,authorized_amount)
 values(s,c,j,e,'TEST NON-CUSTOMER','Rollback test',true,1);
 exception when others then r:=true; end;
 assert r,'forged amount must fail';
 r:=false;
 begin
 insert into public.customer_authorizations(shop_id,customer_id,job_id,estimate_id,typed_name,statement,accepted,authorized_amount)
 values(s,c,j,e,'TEST NON-CUSTOMER','Rollback test',false,123);
 exception when others then r:=true; end;
 assert r,'unaccepted event must fail';
 insert into public.customer_authorizations(shop_id,customer_id,job_id,estimate_id,typed_name,statement,accepted,authorized_amount)
 values(s,c,j,e,'TEST NON-CUSTOMER','Rollback test',true,123);
 assert (select status='approved' and coalesce(amount_paid,0)=0 from public.jobs where id=j),'authorization must approve without marking paid';
 execute 'reset role';
 assert exists(select 1 from public.authorizations where job_id=j and recorded_by=u),'verified caller must be recorded';
 assert not exists(select 1 from public.invoices where job_id=j),'authorization must not create invoice';
 assert not exists(select 1 from public.payment_records where job_id=j),'authorization must not create payment';
end;
$test$;
ROLLBACK;
SELECT 'PASS: forged amount rejected, explicit acceptance required, valid authorization stored, caller recorded, no invoice/payment/paid state; fixtures rolled back' result;
