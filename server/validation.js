'use strict';
const { HttpError } = require('./http');
const currencies = { USD: 2, CAD: 2, EUR: 2, GBP: 2, AUD: 2, JPY: 0, KWD: 3 };
function bad(message) { throw new HttpError(400, message); }
function text(value, field, max = 200, optional = false) {
 if (optional && (value === undefined || value === null || value === '')) return null;
 if (typeof value !== 'string' || !value.trim() || value.length > max) bad(`Invalid ${field}`);
 return value.trim();
}
function money(value, field, zero = true) {
 // API accepts integer minor units, never decimal amounts; cap keeps item multiplication safe.
 if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1) || value > 100000000000) bad(`Invalid ${field}: integer minor units required`);
 return value;
}
function currency(value) { if (!Object.hasOwn(currencies, value)) bad('Unsupported currency'); return value; }
function date(value, field) {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) bad(`Invalid ${field}`);
 return value;
}
function sale(b) {
 const quantity = b.quantity;
 if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) bad('Invalid quantity');
 if (!['paid','unpaid'].includes(b.payment_status)) bad('Invalid payment status');
 const unit_price = money(b.unit_price, 'unit_price');
 const total = unit_price * quantity;
 if (!Number.isSafeInteger(total)) bad('Total too large');
 return { customer: text(b.customer,'customer',200,true), product_id: text(b.product_id,'product_id',200,true), product_name_snapshot: text(b.product_name_snapshot,'item'), quantity, unit_price, unit_cost: b.unit_cost === null || b.unit_cost === undefined ? null : money(b.unit_cost,'unit_cost'), total, currency: currency(b.currency), sale_date: date(b.sale_date,'sale date'), due_date: b.due_date ? date(b.due_date,'due date') : null, payment_status: b.payment_status, payment_method: text(b.payment_method,'payment method',80), notes: text(b.notes,'notes',4000,true) };
}
function expense(b) { return { category:text(b.category,'category',100), description:text(b.description,'description',500), vendor:text(b.vendor,'vendor',200,true), amount:money(b.amount,'amount',false), currency:currency(b.currency), expense_date:date(b.expense_date,'expense date'), payment_method:text(b.payment_method,'payment method',80,true), notes:text(b.notes,'notes',4000,true) }; }
function filters(url) {
 const p = new URL(url, 'https://finance.invalid').searchParams;
 const from = date(p.get('from') || '1900-01-01','from'), to = date(p.get('to') || '9999-12-31','to');
 if (from > to) bad('Invalid date range');
 const offset = Number(p.get('offset') || 0);
 if (!Number.isInteger(offset) || offset < 0 || offset > 1000000) bad('Invalid offset');
 return { currency: currency(p.get('currency') || 'USD'), from, to, offset };
}
module.exports = { sale, expense, filters, currencies };
