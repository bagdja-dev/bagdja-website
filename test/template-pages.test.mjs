import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateTemplatePage } from '../lib/template-page-contract.ts';
import {
  buildCalendarPage,
  buildOrdersPage,
  buildTagihanPage,
  createPageKeyFactory,
  toIsoDateTime,
  toMoney,
} from '../lib/template-pages.ts';

const key = createPageKeyFactory('user-1', 'test-secret', 'test');
const options = { basePath: '/toko', key };

test('opaque keys are stable per user and never contain the raw id', () => {
  const first = key('transaction', 'b7c1d8e2-0000-4000-8000-000000000001');
  assert.equal(first, key('transaction', 'b7c1d8e2-0000-4000-8000-000000000001'));
  assert.notEqual(first, createPageKeyFactory('user-2', 'test-secret', 'test')('transaction', 'b7c1d8e2-0000-4000-8000-000000000001'));
  assert.doesNotMatch(first, /b7c1d8e2/);
  assert.match(first, /^[A-Za-z0-9_-]{6,128}$/);
  assert.throws(() => createPageKeyFactory('user-1', '', 'production'), /TEMPLATE_PAGE_KEY_SECRET/);
});

test('normalizes money and dates to the contract', () => {
  assert.equal(toMoney('750000.00'), 750000);
  assert.equal(toMoney(-5), 0);
  assert.equal(toIsoDateTime('2026-11-22'), '2026-11-22T00:00:00+07:00');
  assert.equal(toIsoDateTime('2026-11-22T02:00:00.000Z'), '2026-11-22T02:00:00.000Z');
  assert.equal(toIsoDateTime(null), undefined);
});

test('builds a contract-valid orders page with outstanding termins', () => {
  const page = buildOrdersPage([
    {
      id: 'trx-1', total_amount: '1250000.00', status: 'COMPLETED', ref_number: 'INV-1', created_at: '2026-11-08T03:00:00.000Z',
      termin_summary: { total: 3, paid: 1, issued: 1, scheduled: 1 },
      items: [{ order: { product: { name: 'Family Camp' } } }, { order: { product: { name: 'Paket makan' } } }],
    },
    { id: 'trx-2', total_amount: 50000, status: 'PENDING_PAYMENT', created_at: '2026-11-09T03:00:00.000Z' },
  ], options);
  assert.deepEqual(validateTemplatePage(page), []);
  assert.equal(page.transactions[0].outstanding.label, 'Sisa 2 Tagihan');
  assert.deepEqual(page.transactions[0].itemNames, ['Family Camp', 'Paket makan']);
  assert.equal(page.transactions[0].detailHref, '/toko/order/trx-1');
  assert.equal(page.transactions[1].reference, '#TRX-2');
  assert.equal(page.transactions[1].statusLabel, 'Menunggu pembayaran');
});

test('builds a contract-valid tagihan page from termins and gathering invoices', () => {
  const page = buildTagihanPage(
    [{ id: 't1', sequence: 2, label: 'Pelunasan', amount: '750000', status: 'ISSUED', anchorStepName: 'Konfirmasi', orderId: 'o1', orderTransactionId: 'trx-1', productName: 'Family Camp', createdAt: '2026-11-05T03:00:00.000Z' }],
    [
      { id: 'reg-1', transaction_id: 'trx-9', invoice_id: 'INV-KMP-1', plan_number: 'KMP-1', gathering_title: 'Workshop', amount: 350000, payment_status: 'PENDING_PAYMENT', invoice_status: 'ISSUED', invoice_issued_at: '2026-11-08T02:00:00.000Z', payment_deadline: '2026-11-15', can_pay: true },
      { id: 'reg-2', invoice_id: 'INV-KMP-2', plan_number: 'KMP-2', gathering_title: 'Diskusi', amount: 125000, payment_status: 'PENDING_PAYMENT', invoice_status: 'SCHEDULED', invoice_issued_at: null, can_pay: false },
    ],
    options,
  );
  assert.deepEqual(validateTemplatePage(page), []);
  assert.deepEqual(page.invoices.map((invoice) => invoice.status), ['ISSUED', 'ISSUED', 'SCHEDULED']);
  assert.equal(page.invoices[0].canPay, true);
  assert.equal(page.invoices[1].detailHref, '/toko/gathering/invoice/reg-1');
  assert.equal(page.invoices[1].dueAt, '2026-11-15T00:00:00+07:00');
  assert.equal(page.invoices[2].canPay, false);
});

test('builds a contract-valid calendar page and starts at the first event month', () => {
  const page = buildCalendarPage(
    [{ id: 'p1', plan_number: 'KMP-1', order_id: 'o1', title: 'Family Camp', status: 'PREORDER', workflow_step: 'PLAN', occurrence: { status: 'RSVP_OPEN', min_attendees: 3, max_attendees: 20, final_schedule: '2026-12-12T01:00:00.000Z' } }],
    [{ id: 'i1', gathering_title: 'Workshop', plan_number: 'KMP-2', initiator_name: 'Alya', event_date: '2026-12-06T02:00:00.000Z', event_location: 'Kemang', registration_status: null, action: 'RSVP', action_path: '/gathering/invite/abc' }],
    options,
  );
  assert.deepEqual(validateTemplatePage(page), []);
  assert.equal(page.initialMonth, '2026-12');
  assert.equal(page.plans[0].stepLabel, 'Atur rencana');
  assert.equal(page.plans[0].detailHref, '/toko/cart/order/o1');
  assert.equal(page.invitations[0].needsAction, true);
  assert.equal(page.invitations[0].detailHref, '/toko/gathering/invite/abc');
});

test('builds a contract-valid invoice detail page and asks guests to log in before paying', async () => {
  const { buildInvoiceDetailPage } = await import('../lib/template-pages.ts');
  const invoice = {
    id: 'reg-1', invoice_id: 'INV-KMP-1', plan_number: 'KMP-1', gathering_title: 'Workshop', initiator_name: 'Dita',
    attendee_name: 'Rini', amount: 350000, payment_status: 'UNPAID', invoice_issued_at: '2026-11-08T02:00:00.000Z',
    payment_deadline: '2026-11-15T16:59:00.000Z', event_date: '2026-11-22', payment_open: true,
  };
  const guest = buildInvoiceDetailPage(invoice, { key, loggedIn: false });
  assert.deepEqual(validateTemplatePage(guest), []);
  assert.equal(guest.canPay, true);
  assert.equal(guest.loginRequired, true);
  assert.equal(guest.invoice.eventAt, '2026-11-22T00:00:00+07:00');
  const paid = buildInvoiceDetailPage({ ...invoice, payment_status: 'PAID' }, { key, loggedIn: true });
  assert.equal(paid.canPay, false);
  assert.equal(paid.invoice.statusLabel, 'Lunas');
});

test('builds a contract-valid gathering plan page without invitee contacts', async () => {
  const { buildGatheringPlanPage } = await import('../lib/template-pages.ts');
  const page = buildGatheringPlanPage(
    {
      id: 'plan-1', plan_number: 'KMP-38', title: 'Workshop Keramik', status: 'PREORDER', workflow_step: 'PLAN', invite_policy: 'OPEN',
      occurrence: {
        status: 'RSVP_OPEN', price_per_seat: 425000, min_attendees: 3, max_attendees: 24, deposit_amount_per_seat: 125000,
        final_schedule: '2026-12-20T02:00:00.000Z', final_location: 'Kemang', rsvp_close_at: '2026-12-10', payment_deadline: null,
        option_groups_snapshot: [
          { product_option_id: 'opt-a', option_group_key: 'Sesi', label: 'Sesi pagi' },
          { product_option_id: 'opt-b', option_group_key: 'Sesi', label: 'Sesi siang', is_final_selection: true },
        ],
        opened_option_ids_snapshot: ['opt-a'],
        voting_results: { Sesi: { options: { 'opt-a': { votes: 4 } } } },
      },
    },
    [
      { id: 'i1', invitee_name: 'Dewi', status: 'ACCEPTED', email: 'dewi@example.test' },
      { id: 'i2', invitee_name: null, status: 'EXPIRED' },
    ],
    { key, viewerRole: 'initiator' },
  );
  assert.deepEqual(validateTemplatePage(page), []);
  assert.equal(page.plan.occurrence.seatPrice, 425000);
  assert.equal(page.plan.occurrence.options[0].votes, 4);
  assert.equal(page.plan.occurrence.options[0].isOpen, true);
  assert.equal(page.plan.occurrence.options[1].isFinal, true);
  assert.deepEqual(page.invitees, [
    { name: 'Dewi', rsvpStatus: 'ACCEPTED', rsvpLabel: 'Hadir' },
    { name: 'Peserta', rsvpStatus: 'DECLINED', rsvpLabel: 'Tidak hadir' },
  ]);
  assert.doesNotMatch(JSON.stringify(page), /example\.test/);
});

test('builds a contract-valid cart page that mirrors the host checkout rules', async () => {
  const { buildCartPage } = await import('../lib/template-pages.ts');
  const page = buildCartPage(
    [
      { id: 'o1', product: { name: 'Tas', images: ['https://cdn.test/tas.jpg'], metadata: { variant_attributes: { Warna: 'Hitam' } } }, quantity: 2, unit_price: '450000.00', quoted_total_amount: null },
      { id: 'o2', product: { name: 'Kanopi', quotable: true }, quantity: 1, unit_price: 0, quoted_total_amount: null },
      { id: 'o3', product: { name: 'Plan' }, quantity: 1, unit_price: 0, quoted_total_amount: null, metadata: { gathering: { role: 'initiator', group_id: 'g1' } } },
      { id: 'o4', product: { name: 'E-book', type: 'digital' }, quantity: 3, unit_price: 50000, quoted_total_amount: null },
    ],
    [{ order_id: 'o3', title: 'Workshop Keramik', occurrence: { final_schedule: null } }],
    options,
  );
  assert.deepEqual(validateTemplatePage(page), []);
  assert.deepEqual(page.items.map((item) => [item.kind, item.checkoutable, item.blockedReason ?? null]), [
    ['product', true, null],
    ['product', false, 'Menunggu penawaran'],
    ['gathering_plan', false, 'Rencana gathering belum masuk tahap pembayaran'],
    ['digital', true, null],
  ]);
  assert.equal(page.items[0].variant, 'Hitam');
  assert.equal(page.items[2].name, 'Workshop Keramik');
  assert.equal(page.items[3].quantity, 1);
  assert.equal(page.items[3].quantityEditable, false);
  assert.equal(page.items[0].detailHref, '/toko/cart/order/o1');
});

function fakeApi(routes) {
  const calls = [];
  return {
    calls,
    fetch: async (path, init = {}) => {
      calls.push([init.method ?? 'GET', path, init.body ?? null]);
      const handler = routes[`${init.method ?? 'GET'} ${path.split('?')[0]}`];
      return handler ? handler(init) : { data: { message: 'not found' }, status: 404 };
    },
  };
}

test('executes cart intents only for items in the buyer session', async () => {
  const { executeTemplateIntent, CART_KEY_KIND } = await import('../lib/template-pages.ts');
  const orders = [
    { id: 'o1', product: { name: 'Tas' }, quantity: 1, unit_price: 100000, quoted_total_amount: null },
    { id: 'o2', product: { name: 'Kanopi', quotable: true }, quantity: 1, unit_price: 0, quoted_total_amount: null },
  ];
  const api = fakeApi({
    'GET /api/orders': () => ({ data: { data: orders }, status: 200 }),
    'PATCH /api/orders/o1': () => ({ data: {}, status: 200 }),
    'DELETE /api/orders/o1': () => ({ data: {}, status: 200 }),
  });
  const context = { pageType: 'cart', websiteId: 'w1', basePath: '/toko', key, fetch: api.fetch };
  const k1 = key(CART_KEY_KIND, 'o1');
  const k2 = key(CART_KEY_KIND, 'o2');

  assert.equal((await executeTemplateIntent({ action: 'cart.set_quantity', key: k1, quantity: 3 }, context)).body.ok, true);
  assert.deepEqual(api.calls.find(([method]) => method === 'PATCH'), ['PATCH', '/api/orders/o1', '{"quantity":3}']);
  assert.equal((await executeTemplateIntent({ action: 'cart.remove', key: k1 }, context)).body.ok, true);

  const otherUsersKey = createPageKeyFactory('user-2', 'test-secret', 'test')(CART_KEY_KIND, 'o1');
  const forged = await executeTemplateIntent({ action: 'cart.remove', key: otherUsersKey }, context);
  assert.equal(forged.status, 409);

  const checkout = await executeTemplateIntent({ action: 'cart.checkout', keys: [k1] }, context);
  assert.deepEqual(checkout.body, { ok: true, redirect: '/toko/checkout?order_ids=o1' });
  const blocked = await executeTemplateIntent({ action: 'cart.checkout', keys: [k1, k2] }, context);
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.message, /Menunggu penawaran/);

  const wrongPage = await executeTemplateIntent({ action: 'cart.remove', key: k1 }, { ...context, pageType: 'orders' });
  assert.equal(wrongPage.status, 403);
});

test('pays termins and gathering invoices through the host payment flow', async () => {
  const { executeTemplateIntent } = await import('../lib/template-pages.ts');
  const api = fakeApi({
    'GET /api/transactions/termins': () => ({ data: { data: [
      { id: 't1', sequence: 2, label: 'Pelunasan', amount: 1, status: 'ISSUED', anchorStepName: null, orderId: 'o', orderTransactionId: null, productName: 'X', createdAt: '2026-11-01T00:00:00Z' },
      { id: 't2', sequence: 1, label: 'DP', amount: 1, status: 'PAID', anchorStepName: null, orderId: 'o', orderTransactionId: null, productName: 'X', createdAt: '2026-11-01T00:00:00Z' },
    ] }, status: 200 }),
    'GET /api/gathering/invoices': () => ({ data: [{ id: 'reg-1', can_pay: true }], status: 200 }),
    'POST /api/transactions/termins/t1/pay': () => ({ data: { checkout_url: 'https://pay.test/t1' }, status: 200 }),
    'POST /api/gathering/registrations/reg-1/seat-order': () => ({ data: { id: 'seat-order-1', checkout_url: null }, status: 201 }),
    'POST /api/transactions/checkout': () => ({ data: { checkout_url: 'https://pay.test/seat' }, status: 200 }),
  });
  const context = { pageType: 'tagihan', websiteId: 'w1', basePath: '/toko', key, fetch: api.fetch };
  assert.deepEqual((await executeTemplateIntent({ action: 'invoice.pay', key: key('termin', 't1') }, context)).body, { ok: true, redirect: 'https://pay.test/t1' });
  assert.equal((await executeTemplateIntent({ action: 'invoice.pay', key: key('termin', 't2') }, context)).status, 409);
  const gathering = await executeTemplateIntent({ action: 'invoice.pay', key: key('gathering_invoice', 'reg-1') }, { ...context, pageType: 'invoice_detail' });
  assert.deepEqual(gathering.body, { ok: true, redirect: 'https://pay.test/seat' });
  assert.deepEqual(api.calls.at(-1), ['POST', '/api/transactions/checkout', '{"order_ids":["seat-order-1"]}']);
});

test('sends calendar RSVP to the host invitation page', async () => {
  const { executeTemplateIntent } = await import('../lib/template-pages.ts');
  const api = fakeApi({
    'GET /api/gathering/invitations/mine': () => ({ data: [{ id: 'i1', action: 'RSVP', action_path: '/gathering/invite/abc' }], status: 200 }),
  });
  const result = await executeTemplateIntent(
    { action: 'gathering.respond', key: key('gathering_invitation', 'i1') },
    { pageType: 'calendar', websiteId: 'w1', basePath: '/toko', key, fetch: api.fetch },
  );
  assert.deepEqual(result.body, { ok: true, redirect: '/toko/gathering/invite/abc' });
});
