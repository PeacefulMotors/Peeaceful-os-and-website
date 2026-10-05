-- Run AFTER the migration inside a transaction; everything rolls back.
DO $test$
declare
 shop uuid; c uuid; v1 uuid; v2 uuid; v3 uuid; j uuid; r jsonb; n int;
 em text:=gen_random_uuid()::text||'@example.invalid';
 bk uuid[]:=array(select gen_random_uuid() from generate_series(1,8));
 vinX text:='TEST'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,13));
 vinY text:='TEST'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,13));
 other_cust uuid; other_v uuid;
begin
 select id into shop from public.shops order by id limit 1;
 assert not exists(select 1 from public.customers where regexp_replace(coalesce(phone,''),'[^0-9]','','g') in ('2025550188','12025550188')), 'fixture phone in use';
 -- 1. no VIN -> provisional vehicle, unverified, parsed ymm, linked to job
 insert into public.bookings(id,shop_id,name,email,phone,vehicle,service,booking_date,booking_window)
 values(bk[1],shop,'TEST — NON-CUSTOMER rollback',em,'202-555-0188','2023 Ford F150 · 63001 miles','Rollback verification','2099-02-01','Morning 8:30-11:00');
 select customer_id,job_id into c,j from public.bookings where id=bk[1];
 select vehicle_id into v1 from public.jobs where id=j;
 assert v1 is not null, 'provisional vehicle must be created and linked';
 assert (select vin is null and vin_status='unverified' and year=2023 and make='Ford' and model='F150' and customer_id=c from public.vehicles where id=v1), 'provisional fields wrong';
 -- 2. retry is idempotent
 r:=public.promote_booking(bk[1]);
 assert (r->>'vehicle_id')::uuid=v1 and (select count(*)=1 from public.vehicles where customer_id=c), 'retry must not duplicate';
 -- 3. repeat booking same ymm reuses
 insert into public.bookings(id,shop_id,name,email,phone,vehicle,service,booking_date,booking_window)
 values(bk[2],shop,'TEST — NON-CUSTOMER rollback',em,'202-555-0188','2023 FORD f150','Rollback verification','2099-02-02','Morning 8:30-11:00');
 assert (select j2.vehicle_id=v1 from public.jobs j2 join public.bookings b on b.job_id=j2.id where b.id=bk[2]), 'same ymm must reuse';
 -- 4. different vehicle -> second vehicle, same customer
 insert into public.bookings(id,shop_id,name,email,phone,vehicle,service,booking_date,booking_window)
 values(bk[3],shop,'TEST — NON-CUSTOMER rollback',em,'202-555-0188','2019 Honda Civic','Rollback verification','2099-02-03','Morning 8:30-11:00');
 select j2.vehicle_id into v2 from public.jobs j2 join public.bookings b on b.job_id=j2.id where b.id=bk[3];
 assert v2 is not null and v2<>v1 and (select count(*)=2 from public.vehicles where customer_id=c), 'second vehicle expected';
 -- 5. unparsable text -> no vehicle, flagged for review
 insert into public.bookings(id,shop_id,name,email,phone,vehicle,service,booking_date,booking_window)
 values(bk[4],shop,'TEST — NON-CUSTOMER rollback',em,'202-555-0188','my truck','Rollback verification','2099-02-04','Morning 8:30-11:00');
 r:=public.promote_booking(bk[4]);
 assert (r->>'vehicle_id') is null and (r->>'vehicle_requires_review')::boolean, 'unparsable must require review';
 -- 6. ambiguous (two identical ymm vehicles) -> no auto-pick
 insert into public.vehicles(shop_id,customer_id,year,make,model,external_ref) values(shop,c,2019,'Honda','Civic','TEST-DUP-'||bk[5]);
 insert into public.bookings(id,shop_id,name,email,phone,vehicle,service,booking_date,booking_window)
 values(bk[5],shop,'TEST — NON-CUSTOMER rollback',em,'202-555-0188','2019 Honda Civic','Rollback verification','2099-02-05','Morning 8:30-11:00');
 r:=public.promote_booking(bk[5]);
 assert (r->>'vehicle_id') is null and (r->>'vehicle_requires_review')::boolean, 'ambiguous must not auto-pick';
 -- 7. VIN path unchanged and marked provided
 insert into public.bookings(id,shop_id,name,email,phone,vehicle,vin,service,booking_date,booking_window)
 values(bk[6],shop,'TEST — NON-CUSTOMER rollback',em,'202-555-0188','2020 Toyota Tacoma',vinX,'Rollback verification','2099-02-06','Morning 8:30-11:00');
 select j2.vehicle_id into v3 from public.jobs j2 join public.bookings b on b.job_id=j2.id where b.id=bk[6];
 assert (select vin=vinX and vin_status='provided' from public.vehicles where id=v3), 'VIN path must be unchanged';
 -- 8. reconcile: unauthorized denied; service role reconciles; VIN owned elsewhere -> conflict, no merge
 begin
   perform public.reconcile_provisional_vehicle(v1,vinY);
   assert false, 'unauthorized reconcile must fail';
 exception when others then assert sqlerrm like 'Not authorized%', 'wrong error: '||sqlerrm; end;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 perform set_config('request.jwt.claim.role','service_role',true);
 r:=public.reconcile_provisional_vehicle(v2,vinX);   -- vinX already belongs to v3
 assert r->>'status'='conflict_requires_review' and (select vin is null and vin_status='unverified' from public.vehicles where id=v2), 'conflict must not merge';
 r:=public.reconcile_provisional_vehicle(v1,vinY);
 assert r->>'status'='reconciled' and (select vin=vinY and vin_status='provided' from public.vehicles where id=v1), 'reconcile failed';
 begin perform public.reconcile_provisional_vehicle(v1,vinY); assert false,'double reconcile';
 exception when others then assert sqlerrm like 'Vehicle is not a provisional%', 'wrong error: '||sqlerrm; end;
 begin perform public.reconcile_provisional_vehicle(v2,'BADVIN'); assert false,'bad vin';
 exception when others then assert sqlerrm='Invalid VIN', 'wrong error: '||sqlerrm; end;
 -- 9. still one customer
 assert (select count(*)=1 from public.customers where lower(email)=lower(em)), 'customer duplicated';
end;
$test$;
