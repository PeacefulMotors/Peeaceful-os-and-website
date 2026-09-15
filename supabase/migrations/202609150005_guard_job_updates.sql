-- Row policies do not restrict which columns a caller may change.
CREATE OR REPLACE FUNCTION public.guard_customer_technician_job_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare uid uuid:=auth.uid(); role_name text;
begin
  if uid is null then return new; end if;
  select s.role into role_name from public.staff s where s.user_id=uid and s.shop_id::uuid=old.shop_id;
  if role_name in ('owner','admin','service_writer') then return new; end if;
  if role_name is not null and old.assigned_tech=uid then
    if (to_jsonb(new)-ARRAY['status','updated_at','complaint','on_my_way_at','odometer'])
       is distinct from (to_jsonb(old)-ARRAY['status','updated_at','complaint','on_my_way_at','odometer']) then
      raise exception 'Technician updates are limited to assigned job progress';
    end if;
    return new;
  end if;
  if not exists(select 1 from public.profiles p where p.user_id=uid and p.customer_id=old.customer_id)
     or (to_jsonb(new)-ARRAY['status','updated_at']) is distinct from (to_jsonb(old)-ARRAY['status','updated_at'])
     or old.status<>'estimate' or new.status<>'approved'
     or not exists(select 1 from public.authorizations a where a.job_id=old.id and a.recorded_by=uid) then
    raise exception 'Customer updates require a recorded authorization and cannot change job money or identity';
  end if;
  return new;
end;
$function$;
CREATE TRIGGER guard_customer_technician_job_update
BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.guard_customer_technician_job_update();
