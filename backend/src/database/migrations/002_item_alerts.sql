ALTER TABLE tracked_items
  ADD COLUMN notify_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN notify_price boolean NOT NULL DEFAULT false;
UPDATE tracked_items SET notify_price = true WHERE target_price IS NOT NULL;
ALTER TABLE tracked_items
  ADD CONSTRAINT tracked_items_alerts CHECK (notify_stock OR notify_price),
  ADD CONSTRAINT tracked_items_price_alert CHECK (NOT notify_price OR target_price IS NOT NULL);
ALTER TABLE price_history ALTER COLUMN price DROP NOT NULL;
