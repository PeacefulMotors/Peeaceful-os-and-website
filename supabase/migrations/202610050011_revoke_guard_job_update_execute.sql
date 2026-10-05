-- Applied live as version 20261005124804. Source sync only; do not re-apply.
-- Revoke direct EXECUTE on guard_customer_technician_job_update from client roles.
-- Trigger remains; only the trigger fires this function.

REVOKE ALL ON FUNCTION public.guard_customer_technician_job_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_customer_technician_job_update() FROM anon;
REVOKE ALL ON FUNCTION public.guard_customer_technician_job_update() FROM authenticated;
