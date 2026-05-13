CREATE POLICY "Authenticated can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);