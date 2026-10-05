-- Rollback for DRAFT inbox foundation extension. Apply only if forward was applied.
BEGIN;

DROP POLICY IF EXISTS communication_events_internal_office_read ON public.communication_events;

-- Restore prior insert policy (tech included; no visibility gate).
DROP POLICY IF EXISTS communication_events_office_insert ON public.communication_events;
CREATE POLICY communication_events_office_insert
  ON public.communication_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IN (
      SELECT st.shop_id::uuid FROM public.staff st
      WHERE st.user_id = auth.uid()
        AND st.role = ANY (ARRAY['owner','admin','service_writer','tech'])
    )
  );

DROP INDEX IF EXISTS communication_threads_folder_idx;
DROP INDEX IF EXISTS communication_threads_vehicle_idx;
DROP INDEX IF EXISTS communication_threads_booking_idx;
DROP INDEX IF EXISTS communication_events_visibility_idx;
DROP INDEX IF EXISTS communication_events_channel_idx;

ALTER TABLE public.communication_events
  DROP COLUMN IF EXISTS vehicle_id,
  DROP COLUMN IF EXISTS booking_id,
  DROP COLUMN IF EXISTS estimate_id,
  DROP COLUMN IF EXISTS invoice_id,
  DROP COLUMN IF EXISTS subject,
  DROP COLUMN IF EXISTS from_email,
  DROP COLUMN IF EXISTS to_email,
  DROP COLUMN IF EXISTS folder,
  DROP COLUMN IF EXISTS visibility;

ALTER TABLE public.communication_threads
  DROP COLUMN IF EXISTS vehicle_id,
  DROP COLUMN IF EXISTS booking_id,
  DROP COLUMN IF EXISTS estimate_id,
  DROP COLUMN IF EXISTS invoice_id,
  DROP COLUMN IF EXISTS contact_email,
  DROP COLUMN IF EXISTS folder,
  DROP COLUMN IF EXISTS is_starred,
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS visibility;

ALTER TABLE public.communication_events DROP CONSTRAINT IF EXISTS communication_events_channel_check;
ALTER TABLE public.communication_events
  ADD CONSTRAINT communication_events_channel_check
  CHECK (channel = ANY (ARRAY['sms'::text,'mms'::text,'voice'::text,'voicemail'::text,'system'::text]));

ALTER TABLE public.communication_events DROP CONSTRAINT IF EXISTS communication_events_direction_check;
ALTER TABLE public.communication_events
  ADD CONSTRAINT communication_events_direction_check
  CHECK (direction = ANY (ARRAY['inbound'::text,'outbound'::text]));

-- Re-grant anon defaults if project convention requires (review before run).
-- GRANT SELECT,INSERT,UPDATE,DELETE ON public.communication_threads TO anon;
-- GRANT SELECT,INSERT,UPDATE,DELETE ON public.communication_events TO anon;
-- GRANT SELECT,INSERT,UPDATE,DELETE ON public.communication_numbers TO anon;

COMMIT;
