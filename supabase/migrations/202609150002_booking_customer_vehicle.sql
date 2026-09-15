CREATE OR REPLACE FUNCTION public.promote_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
declare
  b public.bookings%rowtype;
  v_cust uuid; v_job uuid; v_contact uuid; v_ref text; v_created boolean := false;
  v_digits text; v_email text; v_candidates uuid[]; v_vehicle uuid; v_vin text;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'promote_booking: booking % not found', p_booking_id; end if;

  v_ref := 'BK-' || b.id::text;
  v_digits := nullif(regexp_replace(coalesce(b.phone,''), '[^0-9]', '', 'g'), '');

  -- Serialize booking promotions within a shop to prevent concurrent duplicate creation.
  perform pg_advisory_xact_lock(hashtextextended('booking-identity:' || b.shop_id::text, 0));
  if length(v_digits)=11 and left(v_digits,1)='1' then v_digits:=right(v_digits,10); end if;
  v_email:=nullif(lower(btrim(b.email)),'');
  if b.customer_id is not null then
    select id into v_cust from public.customers where id=b.customer_id and shop_id=b.shop_id;
    if v_cust is null then raise exception 'Booking customer is not in this shop'; end if;
  else
    select array_agg(c.id order by c.id) into v_candidates
    from public.customers c
    where c.shop_id=b.shop_id and (
      (v_email is not null and lower(btrim(c.email))=v_email)
      or (v_digits is not null and
        regexp_replace(regexp_replace(coalesce(c.phone_norm,c.phone,''),'[^0-9]','','g'),'^1([0-9]{10})$','\1')=v_digits));
    if coalesce(cardinality(v_candidates),0)>1 then
      raise exception 'Customer identity is ambiguous; office review required';
    end if;
    v_cust:=v_candidates[1];
  end if;
  if v_cust is null then
    insert into public.customers (shop_id,name,phone,email,address,source,external_ref,notify_ok)
    values (b.shop_id,coalesce(nullif(btrim(b.name),''),b.phone,'Website booking'),
      b.phone,b.email,b.service_address,'website-booking',v_ref,false)
    returning id into v_cust;
    v_created:=true;
  end if;

  -- A VIN identifies a vehicle. Free text alone is not sufficient to deduplicate.
  v_vin:=nullif(upper(btrim(b.vin)),'');
  if v_vin is not null then
    if v_vin !~ '^[A-HJ-NPR-Z0-9]{17}$' then raise exception 'Invalid booking VIN'; end if;
    select array_agg(id order by id) into v_candidates from public.vehicles
      where shop_id=b.shop_id and upper(btrim(vin))=v_vin;
    if coalesce(cardinality(v_candidates),0)>1 then
      raise exception 'Vehicle identity is ambiguous; office review required';
    end if;
    v_vehicle:=v_candidates[1];
    if v_vehicle is not null and not exists(
      select 1 from public.vehicles where id=v_vehicle and customer_id=v_cust) then
      raise exception 'Vehicle belongs to another customer; office review required';
    end if;
    if v_vehicle is null then
      insert into public.vehicles(shop_id,customer_id,vin,model,external_ref)
      values(b.shop_id,v_cust,v_vin,b.vehicle,v_ref) returning id into v_vehicle;
    end if;
  end if;

  -- 2. the job, idempotent on the booking reference
  select id into v_job from public.jobs where shop_id = b.shop_id and external_ref = v_ref;
  if v_job is null then
    insert into public.jobs (shop_id, customer_id, service_address, complaint, title, status,
                             external_ref, source, written_on, grand_total)
    values (b.shop_id, v_cust, b.service_address,
            concat_ws(' | ', nullif(trim(b.service),''), nullif(trim(b.vehicle),''), nullif(trim(b.notes),'')),
            coalesce(nullif(trim(b.service),''), 'Website booking'),
            'estimate',
            v_ref, 'website-booking', b.booking_date, b.approved_total)
    returning id into v_job;
  else
    update public.jobs set customer_id = coalesce(customer_id, v_cust) where id = v_job;
  end if;

  if exists(select 1 from public.jobs where id=v_job and
      (shop_id<>b.shop_id or customer_id is distinct from v_cust or
       (v_vehicle is not null and vehicle_id is not null and vehicle_id<>v_vehicle))) then
    raise exception 'Existing job identity conflicts with booking';
  end if;
  if v_vehicle is not null then
    update public.jobs set vehicle_id=v_vehicle where id=v_job and vehicle_id is null;
  end if;

  -- 3. the signature taken at booking IS a written authorization, so record it as one
  if b.signature_png is not null and not exists (select 1 from public.authorizations where job_id = v_job) then
    insert into public.authorizations (job_id, shop_id, authorized_by, authorized_at, method, signature_present, terms_version)
    values (v_job, b.shop_id, coalesce(nullif(trim(b.name),''), b.phone), b.created_at, 'website booking signature', true, 'booking-page');
  end if;

  -- 4. the contact book row, and tie it to the app customer so the money shows on the contact
  v_contact := crm.upsert_contact(jsonb_build_object(
    'shop_id', b.shop_id, 'full_name', b.name, 'phone', b.phone, 'email', b.email,
    'address_line', b.service_address, 'contact_type', 'customer',
    'app_customer_id', v_cust, 'origin', 'website-booking', 'origin_ref', b.id::text,
    'origin_detail', concat_ws(' ', b.service, b.vehicle),
    'first_seen_at', b.created_at, 'last_activity_at', b.created_at));

  update public.bookings
     set job_id = v_job, customer_id = v_cust, contact_id = v_contact,
         promoted_at = coalesce(promoted_at, now())
   where id = b.id;

  return jsonb_build_object('booking', b.id, 'job_id', v_job, 'customer_id', v_cust,
                            'vehicle_id', v_vehicle, 'vehicle_requires_review', v_vehicle is null, 'contact_id', v_contact, 'customer_created', v_created, 'job_ref', v_ref);
end $function$;
