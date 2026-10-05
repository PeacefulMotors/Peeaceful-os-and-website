BEGIN;

DO $test$
DECLARE
  shop uuid; uid uuid; other_shop uuid := gen_random_uuid();
  tid uuid; eid uuid; ok boolean; rl text; vis text;
  roles text[] := ARRAY['owner','admin','service_writer'];
BEGIN
  SELECT id INTO shop FROM public.shops ORDER BY id LIMIT 1;
  SELECT user_id INTO uid FROM public.staff WHERE shop_id = shop::text LIMIT 1;
  ASSERT uid IS NOT NULL, 'need staff';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  FOREACH rl IN ARRAY roles LOOP
    UPDATE public.staff SET role = rl WHERE user_id = uid;
    INSERT INTO public.communication_threads(shop_id, owner_user_id, contact_email, visibility, folder)
      VALUES (shop, uid, 'office@example.com', 'internal', 'inbox') RETURNING id INTO tid;
    INSERT INTO public.communication_events(shop_id, owner_user_id, thread_id, channel, direction, visibility, body)
      VALUES (shop, uid, tid, 'internal_note', 'outbound', 'customer', 'should force internal')
      RETURNING id INTO eid;
    SELECT visibility INTO vis FROM public.communication_events WHERE id = eid;
    ASSERT vis = 'internal', rl || ' internal_note must force visibility=internal';
  END LOOP;

  UPDATE public.staff SET role = 'tech' WHERE user_id = uid;
  ok := false;
  BEGIN
    INSERT INTO public.communication_events(shop_id, owner_user_id, thread_id, channel, direction, visibility, body)
      VALUES (shop, uid, tid, 'internal_note', 'internal', 'internal', 'tech fail');
  EXCEPTION WHEN others THEN ok := true;
  END;
  ASSERT ok, 'tech must not insert internal';

  UPDATE public.staff SET role = 'owner', shop_id = other_shop::text WHERE user_id = uid;
  ok := false;
  BEGIN
    INSERT INTO public.communication_events(shop_id, owner_user_id, thread_id, channel, direction, visibility, body)
      VALUES (shop, uid, tid, 'sms', 'outbound', 'customer', 'cross');
  EXCEPTION WHEN others THEN ok := true;
  END;
  ASSERT ok, 'cross-shop denied';

  PERFORM set_config('request.jwt.claims', '{}', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  ok := false;
  BEGIN
    IF EXISTS (SELECT 1 FROM public.communication_threads LIMIT 1) THEN
      RAISE EXCEPTION 'anon saw threads';
    END IF;
    ok := true;
  EXCEPTION WHEN others THEN ok := true;
  END;
  ASSERT ok, 'anon denied';
END $test$;

ROLLBACK;
