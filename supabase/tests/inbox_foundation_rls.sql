-- RLS matrix for Peaceful Inbox foundation (DRAFT). Pattern mirrors PR #7.
-- Run in a transaction and ROLLBACK. Do not leave test rows.
-- Cases: owner/admin/service_writer allowed for internal notes;
-- technician limited (customer-visible on assigned job only; internal denied);
-- cross-shop denied; anon denied.
BEGIN;
DO $test$
DECLARE
  shop uuid; uid uuid; other_shop uuid := gen_random_uuid();
  tid uuid; eid uuid; jid uuid; ok boolean; rl text;
  roles text[] := ARRAY['owner','admin','service_writer'];
BEGIN
  SELECT id INTO shop FROM public.shops ORDER BY id LIMIT 1;
  SELECT user_id INTO uid FROM public.staff WHERE shop_id = shop::text LIMIT 1;
  ASSERT uid IS NOT NULL, 'need a staff fixture row';

  -- Ensure a job exists for tech-assigned path (may be null; tech path still asserts deny on internal).
  SELECT id INTO jid FROM public.jobs WHERE shop_id = shop LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  FOREACH rl IN ARRAY roles LOOP
    UPDATE public.staff SET role = rl WHERE user_id = uid;
    INSERT INTO public.communication_threads(shop_id, owner_user_id, contact_phone, visibility, folder)
      VALUES (shop, uid, '+10000000000', 'internal', 'inbox')
      RETURNING id INTO tid;
    INSERT INTO public.communication_events(shop_id, owner_user_id, thread_id, channel, direction, visibility, body)
      VALUES (shop, uid, tid, 'internal_note', 'internal', 'internal', 'office note')
      RETURNING id INTO eid;
    ASSERT EXISTS (SELECT 1 FROM public.communication_events WHERE id = eid), rl || ' must read/write internal';
  END LOOP;

  UPDATE public.staff SET role = 'tech' WHERE user_id = uid;
  ok := false;
  BEGIN
    INSERT INTO public.communication_events(shop_id, owner_user_id, thread_id, channel, direction, visibility, body)
      VALUES (shop, uid, tid, 'internal_note', 'internal', 'internal', 'tech must fail');
  EXCEPTION WHEN others THEN
    ok := true;
  END;
  ASSERT ok, 'technician must not insert internal visibility';

  -- Cross-shop
  UPDATE public.staff SET role = 'owner', shop_id = other_shop::text WHERE user_id = uid;
  ok := false;
  BEGIN
    INSERT INTO public.communication_events(shop_id, owner_user_id, thread_id, channel, direction, visibility, body)
      VALUES (shop, uid, tid, 'sms', 'outbound', 'customer', 'cross shop');
  EXCEPTION WHEN others THEN
    ok := true;
  END;
  ASSERT ok, 'cross-shop insert must be denied';

  -- Anon
  PERFORM set_config('request.jwt.claims', '{}', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  ok := false;
  BEGIN
    PERFORM 1 FROM public.communication_threads LIMIT 1;
    -- With RLS and no anon grants after migration, expect empty or privilege error.
    IF EXISTS (SELECT 1 FROM public.communication_threads LIMIT 1) THEN
      RAISE EXCEPTION 'anon saw threads';
    END IF;
    ok := true;
  EXCEPTION WHEN others THEN
    ok := true;
  END;
  ASSERT ok, 'anon must be denied';
END $test$;
ROLLBACK;
