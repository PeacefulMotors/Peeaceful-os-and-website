-- Run using an administrative SQL connection. Every fixture is rolled back.
BEGIN;
DO $test$
declare
 u uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 c2 uuid:=gen_random_uuid(); shop uuid; em text:=gen_random_uuid()::text||'@example.invalid';
 got uuid; rejected boolean;
begin
 select id into shop from public.shops order by id limit 1;
 perform set_config('request.jwt.claim.sub','',true);
 rejected:=false;
 begin perform public.claim_customer_account(); exception when others then rejected:=SQLERRM='Sign in required'; end;
 assert rejected, 'anonymous claim must fail';
 insert into auth.users(id,email,raw_user_meta_data) values(u,em,'{"role":"owner"}');
 assert (select email_confirmed_at is null from auth.users where id=u), 'signup must not auto-confirm';
 assert (select account_type='customer' from public.profiles where user_id=u), 'signup must create customer role';
 assert not exists(select 1 from public.staff where user_id=u), 'signup must not create staff';
 perform set_config('request.jwt.claim.sub',u::text,true);
 rejected:=false;
 begin perform public.claim_customer_account(); exception when others then rejected:=SQLERRM='Verified email required'; end;
 assert rejected, 'unconfirmed claim must fail';
 update auth.users set email_confirmed_at=now() where id=u;
 rejected:=false;
 begin perform public.claim_customer_account(); exception when others then rejected:=SQLERRM like 'No customer record matches%'; end;
 assert rejected, 'missing customer must fail';
 insert into public.customers(id,shop_id,name,email,notify_ok)
 values(c,shop,'TEST — NON-CUSTOMER identity rollback',em,false),
       (c2,shop,'TEST — NON-CUSTOMER duplicate rollback',upper(em),false);
 rejected:=false;
 begin perform public.claim_customer_account(); exception when others then rejected:=SQLERRM like 'Multiple customer records match%'; end;
 assert rejected, 'ambiguous email must fail';
 update public.customers set email=null where id=c2;
 got:=public.claim_customer_account();
 assert got=c, 'unique verified email must claim exact customer';
 assert public.claim_customer_account()=c, 'repeat claim must be idempotent';
 update public.customers set email='changed-'||em where id=c;
 assert public.claim_customer_account()=c, 'existing link must remain stable';
 update public.profiles set account_type='staff' where user_id=u;
 rejected:=false;
 begin perform public.claim_customer_account(); exception when others then rejected:=SQLERRM like 'Staff and business accounts%'; end;
 assert rejected, 'staff profile must not be overwritten';
 assert (select account_type='staff' and customer_id=c from public.profiles where user_id=u), 'staff profile changed';
 update public.profiles set account_type='customer' where user_id=u;
 update public.customers set email=em where id=c;
 update auth.users set email='recovered-'||em where id=u;
 insert into auth.users(id,email,email_confirmed_at) values(u2,em,now());
 perform set_config('request.jwt.claim.sub',u2::text,true);
 rejected:=false;
 begin perform public.claim_customer_account(); exception when others then rejected:=SQLERRM like 'This customer record is already connected%'; end;
 assert rejected, 'another user must not claim existing link';
end;
$test$;
ROLLBACK;
SELECT 'PASS: anonymous, unconfirmed, signup role, missing, ambiguous, exact claim, retry, stable link, staff protection, already-linked denial; all fixtures rolled back' AS result;
