-- Keep Inbox links in their owning shop and internal threads office-only.
CREATE OR REPLACE FUNCTION public.guard_communication_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.communication_threads; linked_shop uuid; item record;
BEGIN
 IF NEW.shop_id IS NULL THEN RAISE EXCEPTION 'Shop required' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='communication_events' THEN
 IF NEW.thread_id IS NOT NULL THEN
  SELECT * INTO t FROM public.communication_threads WHERE id=NEW.thread_id;
  IF NOT FOUND OR t.shop_id IS DISTINCT FROM NEW.shop_id THEN
   RAISE EXCEPTION 'Thread must belong to the same shop' USING ERRCODE='23514';
  END IF;
 END IF;
 END IF;
 FOR item IN SELECT * FROM (VALUES
 ('customers',NEW.customer_id),('vehicles',NEW.vehicle_id),('bookings',NEW.booking_id),
 ('jobs',NEW.job_id),('estimates',NEW.estimate_id),('invoices',NEW.invoice_id)) AS links(tbl,id)
 LOOP
  IF item.id IS NOT NULL THEN
   EXECUTE format('SELECT shop_id::uuid FROM public.%I WHERE id=$1',item.tbl) INTO linked_shop USING item.id;
   IF linked_shop IS DISTINCT FROM NEW.shop_id THEN
    RAISE EXCEPTION 'Linked record must belong to the same shop' USING ERRCODE='23514';
   END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_communication_links() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_communication_threads_links BEFORE INSERT OR UPDATE ON public.communication_threads
FOR EACH ROW EXECUTE FUNCTION public.guard_communication_links();
CREATE TRIGGER guard_communication_events_links BEFORE INSERT OR UPDATE ON public.communication_events
FOR EACH ROW EXECUTE FUNCTION public.guard_communication_links();
ALTER POLICY communication_threads_shop_read ON public.communication_threads
USING (visibility='customer' AND shop_id IN(SELECT st.shop_id::uuid FROM public.staff st WHERE st.user_id=auth.uid())
 AND (EXISTS(SELECT 1 FROM public.staff st WHERE st.user_id=auth.uid() AND st.shop_id::uuid=communication_threads.shop_id
 AND st.role=ANY(ARRAY['owner','admin','service_writer','owner_trainer']))
 OR job_id IN(SELECT j.id FROM public.jobs j WHERE j.assigned_tech=auth.uid())));
