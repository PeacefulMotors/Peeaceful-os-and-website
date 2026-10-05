-- Rollback for proposed revoke of create_my_shop
GRANT EXECUTE ON FUNCTION public.create_my_shop(text, text) TO authenticated;
-- Adjust to exact prior grants if different.
