BEGIN;
DROP TRIGGER IF EXISTS trg_communication_events_force_internal_note ON public.communication_events;
DROP FUNCTION IF EXISTS public.communication_events_force_internal_note();
DROP POLICY IF EXISTS communication_events_internal_office_read ON public.communication_events;
DROP POLICY IF EXISTS communication_events_office_insert ON public.communication_events;
CREATE POLICY communication_events_office_insert ON public.communication_events FOR INSERT TO authenticated
  WITH CHECK (shop_id IN (SELECT st.shop_id::uuid FROM public.staff st WHERE st.user_id = auth.uid() AND st.role = ANY (ARRAY['owner','admin','service_writer','tech'])));
DROP POLICY IF EXISTS communication_events_shop_read ON public.communication_events;
CREATE POLICY communication_events_shop_read ON public.communication_events FOR SELECT TO authenticated
  USING ((shop_id IN (SELECT st.shop_id::uuid FROM public.staff st WHERE st.user_id = auth.uid())) AND ((EXISTS (SELECT 1 FROM public.staff st WHERE st.user_id = auth.uid() AND st.shop_id::uuid = communication_events.shop_id AND st.role = ANY (ARRAY['owner','admin','service_writer','owner_trainer']))) OR (job_id IN (SELECT j.id FROM public.jobs j WHERE j.assigned_tech = auth.uid()))));
DROP INDEX IF EXISTS communication_threads_folder_idx;
DROP INDEX IF EXISTS communication_threads_vehicle_idx;
DROP INDEX IF EXISTS communication_threads_booking_idx;
DROP INDEX IF EXISTS communication_events_visibility_idx;
DROP INDEX IF EXISTS communication_events_channel_idx;
ALTER TABLE public.communication_events DROP COLUMN IF EXISTS vehicle_id, DROP COLUMN IF EXISTS booking_id, DROP COLUMN IF EXISTS estimate_id, DROP COLUMN IF EXISTS invoice_id, DROP COLUMN IF EXISTS subject, DROP COLUMN IF EXISTS from_email, DROP COLUMN IF EXISTS to_email, DROP COLUMN IF EXISTS folder, DROP COLUMN IF EXISTS visibility;
ALTER TABLE public.communication_threads DROP COLUMN IF EXISTS vehicle_id, DROP COLUMN IF EXISTS booking_id, DROP COLUMN IF EXISTS estimate_id, DROP COLUMN IF EXISTS invoice_id, DROP COLUMN IF EXISTS contact_email, DROP COLUMN IF EXISTS folder, DROP COLUMN IF EXISTS is_starred, DROP COLUMN IF EXISTS archived_at, DROP COLUMN IF EXISTS visibility;
ALTER TABLE public.communication_threads DROP CONSTRAINT IF EXISTS communication_threads_contact_present_check;
ALTER TABLE public.communication_threads ALTER COLUMN contact_phone SET NOT NULL;
ALTER TABLE public.communication_events DROP CONSTRAINT IF EXISTS communication_events_channel_check;
ALTER TABLE public.communication_events ADD CONSTRAINT communication_events_channel_check CHECK (channel = ANY (ARRAY['sms'::text,'mms'::text,'voice'::text,'voicemail'::text,'system'::text]));
ALTER TABLE public.communication_events DROP CONSTRAINT IF EXISTS communication_events_direction_check;
ALTER TABLE public.communication_events ADD CONSTRAINT communication_events_direction_check CHECK (direction = ANY (ARRAY['inbound'::text,'outbound'::text]));
COMMIT;
