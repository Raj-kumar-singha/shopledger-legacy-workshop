  const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const orders = require('../lib/orders');

function mixedRateItems() {
  return [
    { id: 1, name: 'Rice', sku: 'R', hsn: '1006', price: 200, qty: 2 },
    { id: 2, name: 'Tea', sku: 'T', hsn: '0902', price: 200, qty: 1 }
  ];
}

test('CURRENT BEHAVIOUR: checkout pricing applies HSN GST rates and apportions a valid coupon', () => {
  const totals = pricing.computeTotals(mixedRateItems(), 'SAVE10');

  assert.deepEqual(
    {
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      cgst: totals.cgst,
      sgst: totals.sgst
    },
    { subtotal: 600, discount: 60, tax: 50.4, total: 590.4, cgst: 25.2, sgst: 25.2 }
  );
  assert.deepEqual(totals.lines.map((line) => ({ gstPercent: line.gstPercent, tax: line.tax })), [
    { gstPercent: 5, tax: 18 },
    { gstPercent: 18, tax: 32.4 }
  ]);
});

test('invoice figures use the same HSN GST rates as checkout pricing', () => {
  const figures = invoice.computeInvoiceFigures({ items: mixedRateItems(), coupon: '' });

  assert.deepEqual(
    { subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax, total: figures.total },
    { subtotal: 600, discount: 0, tax: 56, total: 656 }
  );
  assert.deepEqual(figures.rows.map((row) => row.gstPercent), [5, 18]);
});

test('invoice coupon totals match checkout pricing and use the capped subtotal discount', () => {
  const items = mixedRateItems();
  const checkout = pricing.computeTotals(items, 'SAVE10');
  const figures = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.equal(checkout.total, 590.4);
  assert.equal(figures.discount, 60);
  assert.equal(figures.total, checkout.total);
});

test('CURRENT BEHAVIOUR: orders.add stores the caller-provided ledger totals in an in-memory database', () => {
  const db = { nextOrderId: 1001, orders: [] };
  const order = orders.add(db, {
    customer: 'Walk-in',
    coupon: 'SAVE10',
    items: mixedRateItems(),
    subtotal: 600,
    discount: 60,
    tax: 50.4,
    total: 590.4
  });

  assert.equal(order.id, 1001);
  assert.equal(db.nextOrderId, 1002);
  assert.equal(db.orders[0].total, 590.4);
  assert.equal(invoice.computeInvoiceFigures(order).total, 590.4);
});

test('invoice total and GST must match the checkout ledger for an order', () => {
  const items = mixedRateItems();
  const ledger = pricing.computeTotals(items, 'SAVE10');
  const figures = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.equal(figures.tax, ledger.tax);
  assert.equal(figures.total, ledger.total);
});
