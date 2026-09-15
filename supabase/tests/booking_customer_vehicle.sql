BEGIN;
DO $test$
declare
 shop uuid; b1 uuid:=gen_random_uuid(); b2 uuid:=gen_random_uuid(); b3 uuid:=gen_random_uuid();
 b4 uuid:=gen_random_uuid(); c uuid; v uuid; j uuid; r jsonb;
 em text:=gen_random_uuid()::text||'@example.invalid';
 vin1 text:='TEST'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,13));
 vin2 text:='TEST'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,13));
 rejected boolean;
begin
 select id into shop from public.shops order by id limit 1;
 assert not exists(select 1 from public.customers where regexp_replace(coalesce(phone,''),'[^0-9]','','g') in ('2025550199','12025550199')), 'reserved fixture phone already in use';
 insert into public.bookings(id,shop_id,name,email,phone,vehicle,vin,service,booking_date,booking_window)
 values(b1,shop,'TEST — NON-CUSTOMER rollback',em,'+1 (202) 555-0199','TEST vehicle one',vin1,'Rollback verification','2099-01-01','Morning 8:30-11:00');
 select customer_id,job_id into c,j from public.bookings where id=b1;
 select vehicle_id into v from public.jobs where id=j;
 assert c is not null and v is not null, 'booking must link customer and vehicle';
 r:=public.promote_booking(b1);
 assert (r->>'customer_id')::uuid=c and (r->>'vehicle_id')::uuid=v and (r->>'job_id')::uuid=j, 'retry must retain all IDs';
 insert into public.bookings(id,shop_id,name,email,phone,vehicle,vin,service,booking_date,booking_window)
 values(b2,shop,'TEST — NON-CUSTOMER rollback',upper(em),'202-555-0199','TEST vehicle one',lower(vin1),'Rollback verification','2099-01-02','Morning 8:30-11:00');
 assert (select customer_id=c from public.bookings where id=b2), 'repeat customer must reuse ID';
 assert (select j2.vehicle_id=v from public.jobs j2 join public.bookings b on b.job_id=j2.id where b.id=b2), 'repeat VIN must reuse ID';
 insert into public.bookings(id,shop_id,name,email,phone,vehicle,vin,service,booking_date,booking_window)
 values(b3,shop,'TEST — NON-CUSTOMER rollback',em,'202-555-0199','TEST vehicle two',vin2,'Rollback verification','2099-01-03','Morning 8:30-11:00');
 assert (select customer_id=c from public.bookings where id=b3), 'second VIN must retain customer';
 assert (select count(*)=2 from public.vehicles where customer_id=c), 'customer must have exactly two vehicles';
 assert (select count(*)=1 from public.customers where lower(email)=lower(em)), 'customer duplicated';
 insert into public.bookings(id,shop_id,name,email,phone,vehicle,service,booking_date,booking_window,paid_claimed)
 values(b4,shop,'TEST — NON-CUSTOMER rollback',em,'202-555-0199','TEST unknown VIN','Rollback verification','2099-01-04','Morning 8:30-11:00',true);
 assert (select j2.status='estimate' and j2.vehicle_id is null from public.jobs j2 join public.bookings b on b.job_id=j2.id where b.id=b4), 'payment claim cannot authorize work or invent VIN';
 rejected:=false;
 begin
   update public.bookings set vin=vin1,customer_id=(select id from public.customers where shop_id=shop and id<>c limit 1) where id=b4;
   perform public.promote_booking(b4);
 exception when others then rejected:=SQLERRM like 'Vehicle belongs to another customer%'; end;
 assert rejected, 'wrong customer VIN must fail';
end;
$test$;
ROLLBACK;
SELECT 'PASS: one customer, two VINs, normalized repeat identity, stable booking/job/vehicle IDs, missing VIN flagged, paid claim cannot authorize, wrong-owner VIN rejected; all fixtures rolled back' result;
