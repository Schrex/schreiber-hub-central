CREATE TABLE public.org_chart_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title text,
  parent_id uuid REFERENCES public.org_chart_nodes(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  contact_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_chart_nodes_parent ON public.org_chart_nodes(parent_id);

ALTER TABLE public.org_chart_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view org chart"
  ON public.org_chart_nodes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins insert org chart"
  ON public.org_chart_nodes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update org chart"
  ON public.org_chart_nodes FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete org chart"
  ON public.org_chart_nodes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_org_chart_nodes_updated_at
  BEFORE UPDATE ON public.org_chart_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();