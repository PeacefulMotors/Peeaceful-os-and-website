-- Applied live as version 20261005125245. Source sync only; do not re-apply.
-- Owner/admin RPCs to edit closed_dates and evening_open_dates only in app_data.booking_windows.

CREATE OR REPLACE FUNCTION public.owner_list_booking_exceptions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  raw text;
  cfg jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.staff st
    WHERE st.user_id = uid AND st.role = ANY (ARRAY['owner','admin'])
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT value INTO raw FROM public.app_data WHERE key = 'booking_windows' LIMIT 1;
  IF raw IS NULL THEN RAISE EXCEPTION 'booking_windows missing'; END IF;
  cfg := raw::jsonb;
  RETURN jsonb_build_object(
    'closed_dates', coalesce(cfg->'closed_dates', '[]'::jsonb),
    'evening_open_dates', coalesce(cfg->'evening_open_dates', '[]'::jsonb),
    'evening_window', coalesce(cfg->>'evening_window', 'Evening 6:00-8:30')
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.owner_set_booking_exception(p_date date, p_kind text, p_on boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  raw text;
  cfg jsonb;
  arr jsonb;
  d text;
  arr_key text;
  today_chi date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.staff st
    WHERE st.user_id = uid AND st.role = ANY (ARRAY['owner','admin'])
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_kind NOT IN ('closed', 'evening_open') THEN RAISE EXCEPTION 'Invalid kind'; END IF;
  IF p_date IS NULL THEN RAISE EXCEPTION 'Date required'; END IF;
  d := to_char(p_date, 'YYYY-MM-DD');
  today_chi := (timezone('America/Chicago', now()))::date;
  IF p_date < today_chi THEN RAISE EXCEPTION 'Past dates are not allowed'; END IF;
  IF p_kind = 'evening_open' AND extract(dow FROM p_date) = 0 THEN
    RAISE EXCEPTION 'Sunday evening open is not allowed';
  END IF;
  arr_key := CASE WHEN p_kind = 'closed' THEN 'closed_dates' ELSE 'evening_open_dates' END;
  SELECT a.value INTO raw FROM public.app_data a WHERE a.key = 'booking_windows' FOR UPDATE;
  IF raw IS NULL THEN RAISE EXCEPTION 'booking_windows missing'; END IF;
  cfg := raw::jsonb;
  arr := coalesce(cfg->arr_key, '[]'::jsonb);
  IF p_on THEN
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(arr) e WHERE e = d) THEN
      arr := arr || jsonb_build_array(d);
    END IF;
  ELSE
    SELECT coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
      INTO arr
      FROM jsonb_array_elements_text(arr) e
      WHERE e <> d;
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x), '[]'::jsonb)
    INTO arr
    FROM (SELECT DISTINCT e AS x FROM jsonb_array_elements_text(arr) e) s;
  cfg := jsonb_set(cfg, ARRAY[arr_key], arr, true);
  UPDATE public.app_data SET value = cfg::text, updated_at = now() WHERE key = 'booking_windows';
  RETURN public.owner_list_booking_exceptions();
END
$function$;

REVOKE ALL ON FUNCTION public.owner_list_booking_exceptions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_set_booking_exception(date, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_list_booking_exceptions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_set_booking_exception(date, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_list_booking_exceptions() TO service_role;
GRANT EXECUTE ON FUNCTION public.owner_set_booking_exception(date, text, boolean) TO service_role;
