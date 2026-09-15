BEGIN;
DO $test$
declare u uuid:=gen_random_uuid();c uuid:=gen_random_uuid();j uuid:=gen_random_uuid();s uuid;r boolean;
begin
 select id into s from public.shops order by id limit 1;
 insert into auth.users(id,email) values(u,u::text||'@example.invalid');
 insert into public.customers(id,shop_id,name,notify_ok) values(c,s,'TEST NON-CUSTOMER payment guard',false);
 update public.profiles set customer_id=c where user_id=u;
 insert into public.jobs(id,shop_id,customer_id,status,grand_total) values(j,s,c,'estimate',123);
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 r:=false;
 begin update public.jobs set status='approved',amount_paid=123 where id=j; exception when others then r:=SQLERRM like 'Customer updates require%'; end;
 assert r,'customer forged paid state must fail';
 r:=false;
 begin update public.jobs set status='approved' where id=j; exception when others then r:=SQLERRM like 'Customer updates require%'; end;
 assert r,'direct unrecorded approval must fail';
 execute 'reset role';
 assert (select status='estimate' and coalesce(amount_paid,0)=0 from public.jobs where id=j),'failed mutations changed job';
end;
$test$;
ROLLBACK;
SELECT 'PASS: customer cannot forge paid amount or bypass recorded approval; fixtures rolled back' result;
