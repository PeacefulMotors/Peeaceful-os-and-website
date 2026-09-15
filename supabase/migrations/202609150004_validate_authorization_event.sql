-- Validate the existing event path before syncing authorization to the job.
-- customer_authorizations has no created_by column: use the verified caller.
CREATE OR REPLACE FUNCTION public.sync_customer_authorization_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  total numeric;
begin
  if not new.accepted or nullif(btrim(new.typed_name),'') is null then
    raise exception 'Explicit acceptance and typed name required';
  end if;
  if auth.uid() is not null and not exists(select 1 from public.profiles p
    where p.user_id=auth.uid() and p.customer_id=new.customer_id) then
    raise exception 'Customer account mismatch';
  end if;
  select e.total into total from public.jobs j join public.estimates e on e.job_id=j.id
    where j.id=new.job_id and j.shop_id=new.shop_id and j.customer_id=new.customer_id
      and e.id=new.estimate_id and e.shop_id=new.shop_id and j.status='estimate'
    for update of j,e;
  if not found then raise exception 'Estimate is not available for authorization'; end if;
  if total is null or new.authorized_amount is null or total<>new.authorized_amount then
    raise exception 'Estimate total changed. Refresh before authorizing.';
  end if;
  insert into public.authorizations(job_id,shop_id,authorized_by,authorized_at,method,signature_present,terms_version,recorded_by)
  values(new.job_id,new.shop_id,new.typed_name,now(),'customer_portal',false,'2026-08-28',auth.uid())
  on conflict(job_id) do update set authorized_by=excluded.authorized_by,
    authorized_at=excluded.authorized_at,method=excluded.method,
    terms_version=excluded.terms_version,recorded_by=excluded.recorded_by,updated_at=now();
  update public.jobs set status='approved',updated_at=now()
    where id=new.job_id and customer_id=new.customer_id and status='estimate';
  return new;
end;
$function$;
