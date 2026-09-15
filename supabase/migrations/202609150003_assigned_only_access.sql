-- Office retains shop management; technicians access only assigned-job vehicles.
ALTER POLICY "shop staff see their vehicles" ON public.vehicles
USING (shop_id IN (SELECT s.shop_id::uuid FROM public.staff s
 WHERE s.user_id=(SELECT auth.uid()) AND s.role IN ('owner','admin','service_writer')))
WITH CHECK (shop_id IN (SELECT s.shop_id::uuid FROM public.staff s
 WHERE s.user_id=(SELECT auth.uid()) AND s.role IN ('owner','admin','service_writer')));
CREATE POLICY "tech reads assigned job vehicles" ON public.vehicles FOR SELECT TO authenticated
USING (id IN (SELECT j.vehicle_id FROM public.jobs j WHERE j.assigned_tech=(SELECT auth.uid())));
CREATE POLICY "tech updates assigned job vehicles" ON public.vehicles FOR UPDATE TO authenticated
USING (id IN (SELECT j.vehicle_id FROM public.jobs j WHERE j.assigned_tech=(SELECT auth.uid())))
WITH CHECK (id IN (SELECT j.vehicle_id FROM public.jobs j WHERE j.assigned_tech=(SELECT auth.uid())));
-- Being the historic performer must not bypass current job assignment.
ALTER POLICY "tech runs own inspections" ON public.inspections
USING (job_id IN (SELECT j.id FROM public.jobs j WHERE j.assigned_tech=(SELECT auth.uid())))
WITH CHECK (job_id IN (SELECT j.id FROM public.jobs j WHERE j.assigned_tech=(SELECT auth.uid()))
 AND shop_id IN (SELECT s.shop_id::uuid FROM public.staff s WHERE s.user_id=(SELECT auth.uid())));
