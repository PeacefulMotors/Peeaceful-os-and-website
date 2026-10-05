-- P1: Harden secret DEFINER functions with explicit service_role body checks.
-- Grants and signatures unchanged.

CREATE OR REPLACE FUNCTION public.get_wave_secret_service(p_shop_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'private', 'public', 'pg_temp'
AS $function$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  return (
    select secret_value
    from private.integration_secrets
    where secret_key = 'wave_access_token:' || p_shop_id::text
    limit 1
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.set_wave_secret_service(p_shop_id uuid, p_value text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public', 'pg_temp'
AS $function$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  insert into private.integration_secrets(secret_key, secret_value, updated_at)
  values ('wave_access_token:' || p_shop_id::text, p_value, now())
  on conflict (secret_key) do update
    set secret_value = excluded.secret_value,
        updated_at = excluded.updated_at;
end
$function$;

CREATE OR REPLACE FUNCTION private.set_integration_secret(p_key text, p_value text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'pg_temp'
AS $function$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service role required';
  end if;
  insert into private.integration_secrets(secret_key, secret_value, updated_at)
  values (p_key, p_value, now())
  on conflict (secret_key) do update
    set secret_value = excluded.secret_value,
        updated_at = excluded.updated_at;
end
$function$;
