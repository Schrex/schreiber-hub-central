ALTER TABLE public.bid_item_activities ALTER COLUMN manhours DROP NOT NULL;
ALTER TABLE public.bid_item_activities ALTER COLUMN manhours DROP DEFAULT;
ALTER TABLE public.bid_item_activities ALTER COLUMN shifts DROP NOT NULL;
ALTER TABLE public.bid_item_activities ALTER COLUMN shifts DROP DEFAULT;