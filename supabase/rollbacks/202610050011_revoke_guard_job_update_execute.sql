-- Rollback: restore prior EXECUTE grants on the trigger function.
GRANT EXECUTE ON FUNCTION public.guard_customer_technician_job_update() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_customer_technician_job_update() TO anon;
GRANT EXECUTE ON FUNCTION public.guard_customer_technician_job_update() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_customer_technician_job_update() TO service_role;
