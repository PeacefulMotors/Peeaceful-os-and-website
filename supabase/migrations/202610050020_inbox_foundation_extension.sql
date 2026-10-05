-- Applied live as version 20261005125236 (inbox_foundation_extension). Source filename kept for ordered final-pass set.
-- Peaceful Inbox foundation extension (2026-10-05 final pass).
-- Does NOT alter MX/Twilio/Resend. Tables empty; low risk.

ALTER TABLE public.communication_events DROP CONSTRAINT IF EXISTS communication_events_channel_check;
ALTER TABLE public.communication_events ADD CONSTRAINT communication_events_channel_check
  CHECK (channel = ANY (ARRAY['sms'::text,'mms'::text,'voice'::text,'voicemail'::text,'system'::text,'email'::text,'call'::text,'internal_note'::text]));
ALTER TABLE public.communication_events DROP CONSTRAINT IF EXISTS communication_events_direction_check;
ALTER TABLE public.communication_events ADD CONSTRAINT communication_events_direction_check
  CHECK (direction = ANY (ARRAY['inbound'::text,'outbound'::text,'internal'::text]));

ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'customer';
ALTER TABLE public.communication_threads ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'customer';
DO $$ BEGIN ALTER TABLE public.communication_events ADD CONSTRAINT communication_events_visibility_check CHECK (visibility = ANY (ARRAY['customer'::text,'internal'::text])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.communication_threads ADD CONSTRAINT communication_threads_visibility_check CHECK (visibility = ANY (ARRAY['customer'::text,'internal'::text])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.communication_events_force_internal_note() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $f$
begin
  if new.channel = 'internal_note' then new.visibility := 'internal'; if new.direction is distinct from 'internal' then new.direction := 'internal'; end if; end if;
  return new;
end $f$;
DROP TRIGGER IF EXISTS trg_communication_events_force_internal_note ON public.communication_events;
CREATE TRIGGER trg_communication_events_force_internal_note BEFORE INSERT OR UPDATE OF channel, visibility, direction ON public.communication_events FOR EACH ROW EXECUTE FUNCTION public.communication_events_force_internal_note();

ALTER TABLE public.communication_threads ADD COLUMN IF NOT EXISTS folder text NOT NULL DEFAULT 'inbox';
ALTER TABLE public.communication_threads ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;
ALTER TABLE public.communication_threads ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS folder text NOT NULL DEFAULT 'sent';
DO $$ BEGIN ALTER TABLE public.communication_threads ADD CONSTRAINT communication_threads_folder_check CHECK (folder = ANY (ARRAY['inbox'::text,'starred'::text,'archived'::text,'draft'::text,'sent'::text])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.communication_events ADD CONSTRAINT communication_events_folder_check CHECK (folder = ANY (ARRAY['inbox'::text,'starred'::text,'archived'::text,'draft'::text,'sent'::text])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.communication_threads ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.communication_threads ALTER COLUMN contact_phone DROP NOT NULL;
DO $$ BEGIN ALTER TABLE public.communication_threads ADD CONSTRAINT communication_threads_contact_present_check CHECK ((nullif(btrim(contact_phone),'') IS NOT NULL) OR (nullif(btrim(contact_email),'') IS NOT NULL)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.communication_threads ADD CONSTRAINT communication_threads_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.communication_threads ADD CONSTRAINT communication_threads_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.communication_threads ADD COLUMN IF NOT EXISTS vehicle_id uuid;
ALTER TABLE public.communication_threads ADD COLUMN IF NOT EXISTS booking_id uuid;
ALTER TABLE public.communication_threads ADD COLUMN IF NOT EXISTS estimate_id uuid;
ALTER TABLE public.communication_threads ADD COLUMN IF NOT EXISTS invoice_id uuid;
DO $$ BEGIN ALTER TABLE public.communication_threads ADD CONSTRAINT communication_threads_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.communication_threads ADD CONSTRAINT communication_threads_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.communication_threads ADD CONSTRAINT communication_threads_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.communication_threads ADD CONSTRAINT communication_threads_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.communication_events ADD CONSTRAINT communication_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.communication_events ADD CONSTRAINT communication_events_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS vehicle_id uuid;
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS booking_id uuid;
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS estimate_id uuid;
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS invoice_id uuid;
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS from_email text;
ALTER TABLE public.communication_events ADD COLUMN IF NOT EXISTS to_email text;
DO $$ BEGIN ALTER TABLE public.communication_events ADD CONSTRAINT communication_events_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.communication_events ADD CONSTRAINT communication_events_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.communication_events ADD CONSTRAINT communication_events_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.communication_events ADD CONSTRAINT communication_events_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS communication_threads_folder_idx ON public.communication_threads (shop_id, folder, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS communication_threads_vehicle_idx ON public.communication_threads (vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS communication_threads_booking_idx ON public.communication_threads (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS communication_events_visibility_idx ON public.communication_events (shop_id, visibility, occurred_at DESC);
CREATE INDEX IF NOT EXISTS communication_events_channel_idx ON public.communication_events (shop_id, channel, occurred_at DESC);

DROP POLICY IF EXISTS communication_events_internal_office_read ON public.communication_events;
CREATE POLICY communication_events_internal_office_read ON public.communication_events FOR SELECT TO authenticated
  USING (visibility = 'internal' AND shop_id IN (SELECT st.shop_id::uuid FROM public.staff st WHERE st.user_id = auth.uid() AND st.role = ANY (ARRAY['owner','admin','service_writer'])));

DROP POLICY IF EXISTS communication_events_office_insert ON public.communication_events;
CREATE POLICY communication_events_office_insert ON public.communication_events FOR INSERT TO authenticated
  WITH CHECK (shop_id IN (SELECT st.shop_id::uuid FROM public.staff st WHERE st.user_id = auth.uid() AND ((visibility = 'customer' AND st.role = ANY (ARRAY['owner','admin','service_writer','tech'])) OR (visibility = 'internal' AND st.role = ANY (ARRAY['owner','admin','service_writer'])))));

DROP POLICY IF EXISTS communication_events_shop_read ON public.communication_events;
CREATE POLICY communication_events_shop_read ON public.communication_events FOR SELECT TO authenticated
  USING (visibility = 'customer' AND shop_id IN (SELECT st.shop_id::uuid FROM public.staff st WHERE st.user_id = auth.uid()) AND (EXISTS (SELECT 1 FROM public.staff st WHERE st.user_id = auth.uid() AND st.shop_id::uuid = communication_events.shop_id AND st.role = ANY (ARRAY['owner','admin','service_writer','owner_trainer'])) OR job_id IN (SELECT j.id FROM public.jobs j WHERE j.assigned_tech = auth.uid())));

REVOKE ALL ON TABLE public.communication_threads FROM anon;
REVOKE ALL ON TABLE public.communication_events FROM anon;
REVOKE ALL ON TABLE public.communication_numbers FROM anon;
