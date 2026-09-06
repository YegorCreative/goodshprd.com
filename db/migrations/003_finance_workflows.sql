ALTER TABLE payments ADD COLUMN notes text;
ALTER TABLE refunds ADD COLUMN notes text;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending','completed','paid','expired','cancelled'));

CREATE TABLE product_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL UNIQUE,
  unit_cost bigint NOT NULL CHECK(unit_cost >= 0),
  currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

CREATE TABLE refund_requests (
  request_key uuid PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES payments(id),
  stripe_refund_id text UNIQUE,
  status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','pending','confirmed','failed')),
  amount bigint,
  currency text,
  actor_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_costs_currency ON product_costs(currency);
