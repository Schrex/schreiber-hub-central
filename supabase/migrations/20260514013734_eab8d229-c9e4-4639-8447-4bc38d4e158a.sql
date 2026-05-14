CREATE TABLE public.whiteboard_tiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  day_index smallint NOT NULL CHECK (day_index BETWEEN 0 AND 6),
  section text NOT NULL CHECK (section IN ('jobs','crew','tasks')),
  kind text NOT NULL CHECK (kind IN ('job','crew','task')),
  ref_id uuid,
  label text NOT NULL,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whiteboard_tiles_week ON public.whiteboard_tiles(week_start, day_index, section, sort_order);

ALTER TABLE public.whiteboard_tiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Foreman office admin view whiteboard"
  ON public.whiteboard_tiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'foreman'::app_role) OR has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Foreman office admin insert whiteboard"
  ON public.whiteboard_tiles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'foreman'::app_role) OR has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Foreman office admin update whiteboard"
  ON public.whiteboard_tiles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'foreman'::app_role) OR has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Foreman office admin delete whiteboard"
  ON public.whiteboard_tiles FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'foreman'::app_role) OR has_role(auth.uid(),'office'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_whiteboard_tiles_updated_at
BEFORE UPDATE ON public.whiteboard_tiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboard_tiles;