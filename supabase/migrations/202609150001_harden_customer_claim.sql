-- Fail closed when an email is unverified or maps to multiple customer records.
-- Preserve staff roles and existing customer links; never merge customer data here.
CREATE OR REPLACE FUNCTION public.claim_customer_account()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  em text;
  cid uuid;
  candidates uuid[];
  existing public.profiles%rowtype;
begin
  if uid is null then raise exception 'Sign in required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('customer-claim-user:' || uid::text, 0));
  select lower(btrim(email)) into em from auth.users
    where id=uid and email_confirmed_at is not null;
  if nullif(em,'') is null then raise exception 'Verified email required'; end if;
  select * into existing from public.profiles where user_id=uid for update;
  if exists(select 1 from public.staff where user_id=uid)
     or (existing.user_id is not null and existing.account_type is distinct from 'customer') then
    raise exception 'Staff and business accounts cannot claim a customer profile';
  end if;
  -- A previously established link is stable even when the contact email changes.
  if existing.customer_id is not null then return existing.customer_id; end if;
  perform pg_advisory_xact_lock(hashtextextended('customer-claim-email:' || em, 0));
  select array_agg(id order by id) into candidates from public.customers
    where lower(btrim(email))=em;
  if coalesce(cardinality(candidates),0)=0 then
    raise exception 'No customer record matches this email yet. Book service first or ask Peaceful Motors to attach your customer record.';
  end if;
  if cardinality(candidates)<>1 then
    raise exception 'Multiple customer records match this email. Ask Peaceful Motors to review the records before connecting your account.';
  end if;
  cid:=candidates[1];
  if exists(select 1 from public.profiles where customer_id=cid and user_id<>uid) then
    raise exception 'This customer record is already connected. Ask Peaceful Motors for account recovery.';
  end if;
  insert into public.profiles(user_id,account_type,display_name,customer_id,email)
    values(uid,'customer',split_part(em,'@',1),cid,em)
    on conflict(user_id) do update
      set customer_id=excluded.customer_id,email=excluded.email;
  return cid;
end $function$;
REVOKE ALL ON FUNCTION public.claim_customer_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_customer_account() TO authenticated, service_role;

-- Email confirmation belongs to Supabase Auth, never a blanket database trigger.
-- Keep the trigger/function in place for rollback; remove its unsafe side effect.
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  return new;
end;
$function$;

-- Public signup must not bootstrap staff or owner privileges from an email string.
-- Existing staff/profile rows are untouched. Staff provisioning remains explicit.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles(user_id,account_type,email)
  values(new.id,'customer',lower(new.email))
  on conflict(user_id) do nothing;
  return new;
end;
$function$;
