-- PROPOSED ONLY — do not apply until confirmed no callers remain.
-- Rollback: re-grant EXECUTE to authenticated (and restore prior grants if any).

REVOKE ALL ON FUNCTION public.create_my_shop(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_my_shop(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_my_shop(text, text) FROM authenticated;
-- Keep service_role only if needed for admin tooling; otherwise revoke that too after Owner confirms.
-- GRANT EXECUTE ON FUNCTION public.create_my_shop(text, text) TO service_role;
