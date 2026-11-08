ALTER TABLE tracked_items
  ADD COLUMN fulfillment text NOT NULL DEFAULT 'shipping' CHECK (fulfillment IN ('shipping', 'pickup')),
  ADD COLUMN pickup_zip text,
  ADD COLUMN pickup_radius_miles integer,
  ADD COLUMN pickup_stores jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(pickup_stores) = 'array'),
  ADD CONSTRAINT tracked_items_pickup_location CHECK (
    (fulfillment = 'shipping' AND pickup_zip IS NULL AND pickup_radius_miles IS NULL)
    OR (fulfillment = 'pickup' AND retailer = 'apple' AND url IS NOT NULL
      AND pickup_zip IS NOT NULL AND pickup_zip ~ '^[0-9]{5}$'
      AND pickup_radius_miles IS NOT NULL AND pickup_radius_miles BETWEEN 1 AND 250)
  );
ALTER TABLE price_history
  ADD COLUMN pickup_stores jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(pickup_stores) = 'array');
