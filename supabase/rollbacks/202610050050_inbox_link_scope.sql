DROP TRIGGER IF EXISTS guard_communication_threads_links ON public.communication_threads;
DROP TRIGGER IF EXISTS guard_communication_events_links ON public.communication_events;
DROP FUNCTION IF EXISTS public.guard_communication_links();
ALTER POLICY communication_threads_shop_read ON public.communication_threads USING (((shop_id IN ( SELECT (st.shop_id)::uuid AS shop_id
   FROM staff st
  WHERE (st.user_id = ( SELECT auth.uid() AS uid)))) AND ((EXISTS ( SELECT 1
   FROM staff st
  WHERE ((st.user_id = ( SELECT auth.uid() AS uid)) AND ((st.shop_id)::uuid = communication_threads.shop_id) AND (st.role = ANY (ARRAY['owner'::text, 'admin'::text, 'service_writer'::text, 'owner_trainer'::text]))))) OR (job_id IN ( SELECT j.id
   FROM jobs j
  WHERE (j.assigned_tech = ( SELECT auth.uid() AS uid)))))));
