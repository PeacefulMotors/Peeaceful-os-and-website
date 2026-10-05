-- Rollback for proposed revoke of create_my_shop
GRANT EXECUTE ON FUNCTION public.create_my_shop(text, text) TO authenticated;
-- Exact October 5 baseline: PUBLIC and anon had no EXECUTE grant; leave them revoked.
