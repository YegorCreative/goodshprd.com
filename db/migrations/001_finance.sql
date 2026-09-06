CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL CHECK(provider = 'github'),
 provider_user_id text NOT NULL, email text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider, provider_user_id)
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE oauth_states (
 state_hash text PRIMARY KEY, verifier text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, email text, phone text, stripe_customer_id text UNIQUE,
 notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid REFERENCES customers(id),
 source text NOT NULL CHECK(source IN ('manual','stripe')), status text NOT NULL CHECK(status IN ('pending','completed','paid','expired')),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 subtotal bigint NOT NULL CHECK(subtotal >= 0), discount bigint NOT NULL DEFAULT 0 CHECK(discount >= 0),
 tax bigint NOT NULL DEFAULT 0 CHECK(tax >= 0), total bigint NOT NULL CHECK(total >= 0 AND total = subtotal - discount + tax),
 sale_date date NOT NULL, due_date date, notes text, stripe_checkout_session_id text UNIQUE, stripe_payment_intent_id text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id), product_id text,
 product_name_snapshot text NOT NULL, quantity integer NOT NULL CHECK(quantity > 0),
 unit_price bigint NOT NULL CHECK(unit_price >= 0), unit_cost bigint CHECK(unit_cost >= 0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id), amount bigint NOT NULL CHECK(amount >= 0),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), method text NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','succeeded','failed')), payment_date date NOT NULL,
 stripe_payment_intent_id text UNIQUE, stripe_charge_id text UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES payments(id), amount bigint NOT NULL CHECK(amount > 0),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), refund_date date NOT NULL, stripe_refund_id text UNIQUE,
 reason text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE expenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category text NOT NULL, description text NOT NULL, vendor text,
 amount bigint NOT NULL CHECK(amount > 0), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), expense_date date NOT NULL,
 payment_method text, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE webhook_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL, provider_event_id text NOT NULL UNIQUE,
 event_type text NOT NULL, processed boolean NOT NULL DEFAULT false, processed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id uuid REFERENCES users(id), action text NOT NULL,
 entity_type text NOT NULL, entity_id uuid, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_sale_date ON orders(sale_date);
CREATE INDEX order_items_order ON order_items(order_id);
CREATE INDEX payments_order ON payments(order_id);
CREATE INDEX refunds_payment ON refunds(payment_id);
CREATE INDEX expenses_date ON expenses(expense_date);
-- Reject cross-currency payments/refunds even if a future writer forgets validation.
CREATE FUNCTION finance_currency_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected text;
BEGIN
 IF TG_TABLE_NAME = 'payments' THEN SELECT currency INTO expected FROM orders WHERE id = NEW.order_id;
 ELSE SELECT currency INTO expected FROM payments WHERE id = NEW.payment_id; END IF;
 IF NEW.currency IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Currency mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payments_currency BEFORE INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION finance_currency_guard();
CREATE TRIGGER refunds_currency BEFORE INSERT OR UPDATE ON refunds FOR EACH ROW EXECUTE FUNCTION finance_currency_guard();
CREATE TABLE mutation_keys (
 actor_user_id uuid NOT NULL REFERENCES users(id), request_key uuid NOT NULL, payload_hash text NOT NULL,
 response jsonb, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_user_id,request_key)
);
