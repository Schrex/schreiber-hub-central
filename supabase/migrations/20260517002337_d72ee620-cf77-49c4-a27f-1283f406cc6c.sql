-- Allow foremen to view and manage trucking dispatches from the whiteboard.
CREATE POLICY "Foreman view dispatch orders"
ON public.dispatch_orders FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'foreman'::app_role));

CREATE POLICY "Foreman insert dispatch orders"
ON public.dispatch_orders FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'foreman'::app_role));

CREATE POLICY "Foreman update dispatch orders"
ON public.dispatch_orders FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'foreman'::app_role));

CREATE POLICY "Foreman delete dispatch orders"
ON public.dispatch_orders FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'foreman'::app_role));