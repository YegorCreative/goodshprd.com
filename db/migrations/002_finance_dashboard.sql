-- Preserve financial history: corrections are versioned and deletions retain the row.
ALTER TABLE expenses ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version > 0);
ALTER TABLE expenses ADD COLUMN deleted_at timestamptz;
ALTER TABLE expenses ADD COLUMN deleted_by uuid REFERENCES users(id);
ALTER TABLE expenses ADD COLUMN deletion_reason text;
ALTER TABLE expenses ADD CONSTRAINT expense_deletion_metadata CHECK (
 (deleted_at IS NULL AND deleted_by IS NULL AND deletion_reason IS NULL) OR
 (deleted_at IS NOT NULL AND deleted_by IS NOT NULL AND length(deletion_reason) > 0)
);
CREATE INDEX expenses_active_date ON expenses(currency, expense_date) WHERE deleted_at IS NULL;
CREATE INDEX orders_customer_date ON orders(customer_id, currency, sale_date);
CREATE INDEX payments_currency_date ON payments(currency, payment_date);
CREATE INDEX refunds_currency_date ON refunds(currency, refund_date);
