CREATE TABLE users (
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE,
  password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notifications_enabled boolean NOT NULL DEFAULT true,
  check_interval_minutes integer NOT NULL DEFAULT 15 CHECK (check_interval_minutes BETWEEN 5 AND 10080)
);
CREATE TABLE tracked_items (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  retailer text NOT NULL CHECK (retailer IN ('amazon','target','bestbuy','apple')),
  brand text, model text, sku text, url text,
  target_price numeric(12,2) CHECK(target_price >= 0),
  current_price numeric(12,2) CHECK(current_price >= 0), in_stock boolean,
  last_checked_at timestamptz, last_check_error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracked_items_user ON tracked_items(user_id);
CREATE TABLE price_history (
  id uuid PRIMARY KEY, item_id uuid NOT NULL REFERENCES tracked_items(id) ON DELETE CASCADE,
  price numeric(12,2) NOT NULL CHECK(price >= 0), in_stock boolean NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_history_item_time ON price_history(item_id, checked_at DESC);
CREATE TABLE notifications (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL, body text NOT NULL, read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_time ON notifications(user_id, created_at DESC);
CREATE TABLE device_tokens (
  token text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX device_tokens_user ON device_tokens(user_id);
