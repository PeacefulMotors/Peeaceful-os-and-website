-- DRAFT ONLY. Do not apply until Owner approval.
-- Peaceful Inbox foundation extension (2026-10-05 red-team).
-- Extends existing public.communication_threads / communication_events.
-- Does NOT alter MX, Twilio, Resend, or any transport.
-- Status: PARTIAL schema ready for shared foundation; zero live rows today.

BEGIN;

-- 1) Channel + direction already exist. Widen channel check for email / call / internal_note.
ALTER TABLE public.communication_events
  DROP CONSTRAINT IF EXISTS communication_events_channel_check;
ALTER TABLE public.communication_events
  ADD CONSTRAINT communication_events_channel_check
  CHECK (channel = ANY (ARRAY[
    'sms'::text, 'mms'::text, 'voice'::text, 'voicemail'::text, 'system'::text,
    'email'::text, 'call'::text, 'internal_note'::text
  ]));

-- Keep direction inbound/outbound; internal_note uses outbound + visibility.
ALTER TABLE public.communication_events
  DROP CONSTRAINT IF EXISTS communication_events_direction_check;
ALTER TABLE public.communication_events
  ADD CONSTRAINT communication_events_direction_check
  CHECK (direction = ANY (ARRAY['inbound'::text, 'outbound'::text, 'internal'::text]));

-- 2) Visibility: customer-visible vs staff-internal (stricter RLS below).
ALTER TABLE public.communication_events
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'customer'
    CHECK (visibility = ANY (ARRAY['customer'::text, 'internal'::text]));

ALTER TABLE public.communication_threads
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'customer'
    CHECK (visibility = ANY (ARRAY['customer'::text, 'internal'::text]));

-- 3) Folder / state (starred, archived, draft, sent).
ALTER TABLE public.communication_threads
  ADD COLUMN IF NOT EXISTS folder text NOT NULL DEFAULT 'inbox'
    CHECK (folder = ANY (ARRAY['inbox'::text, 'starred'::text, 'archived'::text, 'draft'::text, 'sent'::text]));
ALTER TABLE public.communication_threads
  ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;
ALTER TABLE public.communication_threads
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.communication_events
  ADD COLUMN IF NOT EXISTS folder text NOT NULL DEFAULT 'sent'
    CHECK (folder = ANY (ARRAY['inbox'::text, 'starred'::text, 'archived'::text, 'draft'::text, 'sent'::text]));

-- 4) FK links (nullable): customer / vehicle / booking / job / estimate / invoice.
-- Existing customer_id / job_id columns had no FK; add them safely.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'communication_threads_customer_id_fkey'
  ) THEN
    ALTER TABLE public.communication_threads
      ADD CONSTRAINT communication_threads_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'communication_threads_job_id_fkey'
  ) THEN
    ALTER TABLE public.communication_threads
      ADD CONSTRAINT communication_threads_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.communication_threads
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;
ALTER TABLE public.communication_threads
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;
ALTER TABLE public.communication_threads
  ADD COLUMN IF NOT EXISTS estimate_id uuid REFERENCES public.estimates(id) ON DELETE SET NULL;
ALTER TABLE public.communication_threads
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.communication_threads
  ADD COLUMN IF NOT EXISTS contact_email text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'communication_events_customer_id_fkey'
  ) THEN
    ALTER TABLE public.communication_events
      ADD CONSTRAINT communication_events_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'communication_events_job_id_fkey'
  ) THEN
    ALTER TABLE public.communication_events
      ADD CONSTRAINT communication_events_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.communication_events
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;
ALTER TABLE public.communication_events
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;
ALTER TABLE public.communication_events
  ADD COLUMN IF NOT EXISTS estimate_id uuid REFERENCES public.estimates(id) ON DELETE SET NULL;
ALTER TABLE public.communication_events
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.communication_events
  ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.communication_events
  ADD COLUMN IF NOT EXISTS from_email text;
ALTER TABLE public.communication_events
  ADD COLUMN IF NOT EXISTS to_email text;

-- 5) Indexes for new filters.
CREATE INDEX IF NOT EXISTS communication_threads_folder_idx
  ON public.communication_threads (shop_id, folder, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS communication_threads_vehicle_idx
  ON public.communication_threads (vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS communication_threads_booking_idx
  ON public.communication_threads (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS communication_events_visibility_idx
  ON public.communication_events (shop_id, visibility, occurred_at DESC);
CREATE INDEX IF NOT EXISTS communication_events_channel_idx
  ON public.communication_events (shop_id, channel, occurred_at DESC);

-- 6) Tighten RLS for internal notes: office roles only for visibility='internal'.
-- Keep existing shop_read for customer-visible / assigned-tech job threads.
DROP POLICY IF EXISTS communication_events_internal_office_read ON public.communication_events;
CREATE POLICY communication_events_internal_office_read
  ON public.communication_events
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'internal'
    AND shop_id IN (
      SELECT st.shop_id::uuid FROM public.staff st
      WHERE st.user_id = auth.uid()
        AND st.role = ANY (ARRAY['owner','admin','service_writer'])
    )
  );

-- Prevent technician INSERT of internal_note / internal visibility.
DROP POLICY IF EXISTS communication_events_office_insert ON public.communication_events;
CREATE POLICY communication_events_office_insert
  ON public.communication_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id IN (
      SELECT st.shop_id::uuid FROM public.staff st
      WHERE st.user_id = auth.uid()
        AND (
          (visibility = 'customer' AND st.role = ANY (ARRAY['owner','admin','service_writer','tech']))
          OR (visibility = 'internal' AND st.role = ANY (ARRAY['owner','admin','service_writer']))
        )
    )
  );

-- Office manage on threads already owner/admin/service_writer; leave as-is.
-- Revoke overly broad table privileges from anon (RLS still applies; hygiene).
REVOKE ALL ON TABLE public.communication_threads FROM anon;
REVOKE ALL ON TABLE public.communication_events FROM anon;
REVOKE ALL ON TABLE public.communication_numbers FROM anon;

COMMIT;
