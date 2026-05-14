ALTER TABLE public.whiteboard_tiles
  ADD COLUMN IF NOT EXISTS parent_tile_id uuid NULL
    REFERENCES public.whiteboard_tiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_whiteboard_tiles_parent
  ON public.whiteboard_tiles(parent_tile_id);