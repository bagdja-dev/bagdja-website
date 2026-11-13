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
  assert.equal(
    createPageKeyFactory('user-1', undefined, 'development')('gathering_plan', 'plan-1'),
    createPageKeyFactory('user-1', undefined, 'development')('gathering_plan', 'plan-1'),
    'key development harus sama meskipun dibuat dari bundle route berbeda',
  );
  assert.notEqual(
    createPageKeyFactory('user-1', undefined, 'development')('gathering_plan', 'plan-1'),
    createPageKeyFactory('user-2', undefined, 'development')('gathering_plan', 'plan-1'),
  );
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
      { id: 'i2', invitee_name: null, status: 'EXPIRED', whatsapp: '62811' },
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

// ── Rencana gathering v2: pengelolaan initiator ───────────────────────────

const planBase = (overrides = {}) => ({
  id: 'plan-1', plan_number: 'KMP-38', title: 'Workshop Keramik', status: 'RSVP_OPEN', workflow_step: 'INVITATION_CONFIRMATION', invite_policy: 'INVITE_ONLY',
  occurrence: {
    status: 'RSVP_OPEN', price_per_seat: 425000, min_attendees: 1, max_attendees: 3, deposit_amount_per_seat: 125000,
    final_schedule: '2026-12-20T02:00:00.000Z', rsvp_close_at: '2026-12-10T16:59:00.000Z', payment_deadline: '2026-12-15T16:59:00.000Z',
    option_groups_snapshot: [
      { product_option_id: 'opt-a', option_group_key: 'Sesi', label: 'Sesi pagi' },
      { product_option_id: 'opt-b', option_group_key: 'Sesi', label: 'Sesi siang' },
      { product_option_id: 'opt-c', option_group_key: 'Menu', label: 'Nasi' },
    ],
    opened_option_ids_snapshot: ['opt-a', 'opt-b'],
  },
  ...overrides,
});

test('gathering plan v2 exposes initiator data without contacts and only actions valid for the step', async () => {
  const { buildGatheringPlanPage, PLAN_KEY_KINDS } = await import('../lib/template-pages.ts');
  const invitations = [
    { id: 'pub-1', invitee_name: null, status: 'PENDING', email: null, whatsapp: null },
    { id: 'inv-1', invitee_name: 'Dewi', status: 'PENDING', email: 'dewi@example.test', whatsapp: '62811', expires_at: '2099-01-01T00:00:00Z' },
  ];
  const registrations = [
    { id: 'reg-1', attendee_name: 'Dewi', registration_status: 'RSVP_CONFIRMED', payment_status: 'UNPAID', invoice_amount: '425000.00', order_id: null,
      selected_option_details: [{ option_group_key: 'Sesi', label: 'Sesi pagi' }] },
    { id: 'reg-2', attendee_name: 'Bima', registration_status: 'REJECTED', payment_status: 'UNPAID', rejection_message: 'Kuota penuh' },
  ];
  const page = buildGatheringPlanPage(planBase({ invite_policy: 'OPEN' }), invitations, {
    key, viewerRole: 'initiator', basePath: '/toko', registrations,
    operation: { kind: 'INVOICE_ISSUANCE', status: 'RUNNING', total_count: 3, processed_count: 1, failed_count: 0 },
  });
  assert.deepEqual(validateTemplatePage(page), []);
  assert.equal(page.contractVersion, 2);
  // inviteHref sengaja memuat id undangan (tautan yang dibagikan initiator, sama dengan UI Bagdja).
  assert.doesNotMatch(JSON.stringify(page), /example\.test|62811|reg-1/);
  assert.equal(page.plan.publicInvitationHref, '/toko/gathering/invite/pub-1');
  assert.equal(page.plan.publicInvitationUrl, undefined, 'tanpa origin tidak ada URL absolut');
  const withOrigin = buildGatheringPlanPage(planBase({ invite_policy: 'OPEN' }), invitations, {
    key, viewerRole: 'initiator', basePath: '/toko', registrations, origin: 'https://kumpul.bagdja.test',
  });
  assert.equal(withOrigin.plan.publicInvitationUrl, 'https://kumpul.bagdja.test/toko/gathering/invite/pub-1');
  assert.deepEqual(validateTemplatePage(withOrigin), []);
  assert.equal(buildGatheringPlanPage(planBase({ invite_policy: 'OPEN' }), invitations, {
    key, viewerRole: 'initiator', basePath: '/toko', origin: 'javascript:alert(1)',
  }).plan.publicInvitationUrl, undefined);
  assert.equal(page.invitations[1].channel, 'email_whatsapp');
  assert.equal(page.invitations[1].inviteHref, '/toko/gathering/invite/id/inv-1');
  assert.equal(page.invitations[1].canRevoke, false, 'revoke hanya di tahap Buat undangan');
  assert.equal(page.invitees.length, 1, 'undangan terbuka bukan peserta');
  assert.equal(page.registrations[0].key, key(PLAN_KEY_KINDS.registration, 'reg-1'));
  assert.equal(page.registrations[0].invoiceAmount, 425000);
  assert.deepEqual(page.registrations[0].selectedOptions, ['Sesi · Sesi pagi']);
  assert.equal(page.registrations[0].canReject, true);
  assert.equal(page.registrations[1].canReject, false);
  assert.equal(page.operation.label, 'Menerbitkan invoice peserta');
  assert.deepEqual(page.actions, ['gathering.respond', 'gathering.registrations.reject', 'gathering.reservations.confirm', 'gathering.cancel']);

  const guest = buildGatheringPlanPage(planBase(), invitations, { key, viewerRole: 'guest', basePath: '/toko', registrations });
  assert.deepEqual(guest.actions, ['gathering.respond']);
  assert.equal(guest.registrations[0].canReject, false);
  assert.equal(guest.invitations[1].inviteHref, undefined);

  const planning = buildGatheringPlanPage(planBase({ workflow_step: 'PLAN', status: 'PREORDER' }), [], { key, viewerRole: 'initiator' });
  assert.deepEqual(planning.actions, ['gathering.respond', 'gathering.plan.save', 'gathering.cancel']);
  const preorderWithOrder = buildGatheringPlanPage(planBase({ workflow_step: 'PLAN', status: 'PREORDER', order_id: 'order-1' }), [], {
    key, viewerRole: 'initiator',
  });
  assert.ok(preorderWithOrder.actions.includes('gathering.chat.open'));
  assert.equal(preorderWithOrder.plan.order_id, undefined, 'ID order tidak diekspos ke template');
  const guestPreorder = buildGatheringPlanPage(planBase({ status: 'PREORDER', order_id: 'order-1' }), [], { key, viewerRole: 'guest' });
  assert.ok(!guestPreorder.actions.includes('gathering.chat.open'), 'chat order hanya tersedia untuk initiator');
  const inviting = buildGatheringPlanPage(planBase({ workflow_step: 'INVITATIONS' }), invitations, { key, viewerRole: 'initiator' });
  assert.deepEqual(inviting.actions, ['gathering.respond', 'gathering.invitation.content.save', 'gathering.invitation.add', 'gathering.invitation.revoke', 'gathering.invitations.submit', 'gathering.cancel']);
  const invitingOpen = buildGatheringPlanPage(planBase({ workflow_step: 'INVITATIONS', invite_policy: 'OPEN' }), [], { key, viewerRole: 'initiator' });
  assert.ok(invitingOpen.actions.includes('gathering.invitation.content.save'), 'tampilan undangan juga untuk akses terbuka');
  assert.ok(!invitingOpen.actions.includes('gathering.invitation.add'), 'daftar peserta hanya untuk khusus undangan');
  const paying = buildGatheringPlanPage(planBase({ workflow_step: 'PAYMENT_CONFIRMATION', status: 'PAYMENT_OPEN' }), [], {
    key, viewerRole: 'initiator', registrations,
  });
  assert.deepEqual(paying.actions, ['gathering.respond', 'gathering.registrations.checkout', 'gathering.invoices.resend', 'gathering.event.confirm', 'gathering.cancel']);
  for (const [workflow_step, status] of [['INVITATIONS', 'PREORDER'], ['INVITATION_CONFIRMATION', 'RSVP_OPEN'], ['PAYMENT_CONFIRMATION', 'PAYMENT_OPEN'], ['PAYMENT_CONFIRMATION', 'CONFIRMED']]) {
    const withOrder = buildGatheringPlanPage(planBase({ workflow_step, status, order_id: 'order-1' }), [], { key, viewerRole: 'initiator', registrations });
    assert.ok(withOrder.actions.includes('gathering.chat.open'), `Diskusikan tersedia di ${workflow_step}/${status}`);
  }
});

test('executes gathering plan intents against the session plan with step gating', async () => {
  const { executeTemplateIntent, PLAN_KEY_KINDS, planDateToIso } = await import('../lib/template-pages.ts');
  let plan = planBase({ workflow_step: 'PLAN', status: 'PREORDER', order_id: 'order-1' });
  const registrations = [
    { id: 'reg-1', attendee_name: 'Dewi', registration_status: 'RSVP_CONFIRMED', payment_status: 'PAID', order_id: 'o1' },
    { id: 'reg-2', attendee_name: 'Bima', registration_status: 'RSVP_CONFIRMED', payment_status: 'UNPAID', invoice_amount: 425000, order_id: null },
  ];
  const api = fakeApi({
    'GET /api/gathering/plans': () => ({ data: [{ id: 'plan-1' }], status: 200 }),
    'GET /api/gathering/plans/plan-1': () => ({ data: plan, status: 200 }),
    'PATCH /api/gathering/plans/plan-1': () => ({ data: {}, status: 200 }),
    'GET /api/gathering/plans/plan-1/registrations': () => ({ data: registrations, status: 200 }),
    'POST /api/gathering/plans/plan-1/registrations/reject': () => ({ data: { rejected_count: 1 }, status: 200 }),
    'POST /api/gathering/plans/plan-1/registrations/collective-checkout': () => ({ data: { checkout_url: 'https://pay.test/c/1' }, status: 200 }),
    'POST /api/chat/w1/customer-threads': () => ({ data: { data: { id: 'thread-1' } }, status: 201 }),
    'POST /api/gathering/plans/plan-1/confirm-event': () => ({ data: null, status: 400, error: '{"message":"Peserta belum lunas"}' }),
    'POST /api/gathering/plans/plan-1/cancel': () => ({ data: {}, status: 200 }),
  });
  const context = { pageType: 'gathering_plan', websiteId: 'w1', basePath: '/toko', key, fetch: api.fetch, origin: 'https://toko.test' };
  const planKey = key(PLAN_KEY_KINDS.plan, 'plan-1');
  const optionKey = (id) => key(PLAN_KEY_KINDS.option, id);

  const openedChat = await executeTemplateIntent({ action: 'gathering.chat.open', key: planKey }, context);
  assert.deepEqual(openedChat.body, { ok: true, redirect: '/toko/chat?thread=thread-1' });
  const chatRequest = JSON.parse(api.calls.find(([method, path]) => method === 'POST' && path === '/api/chat/w1/customer-threads')[2]);
  assert.deepEqual(chatRequest, {
    channel_type: 'order',
    channel_label: 'Rencana KMP-38',
    order_id: 'order-1',
    initial_message: 'Halo, saya ingin berdiskusi tentang rencana Workshop Keramik.',
  });
  plan = { ...plan, order_id: null };
  const missingOrderChat = await executeTemplateIntent({ action: 'gathering.chat.open', key: planKey }, context);
  assert.equal(missingOrderChat.status, 409);
  assert.equal(api.calls.filter(([method, path]) => method === 'POST' && path === '/api/chat/w1/customer-threads').length, 1);
  plan = { ...plan, order_id: 'order-1' };

  assert.equal(planDateToIso('2026-12-10T23:59'), '2026-12-10T16:59:00.000Z');
  assert.equal(planDateToIso('2026-12-10T23:59:00+07:00'), '2026-12-10T16:59:00.000Z');
  assert.equal(planDateToIso('10/12/2026'), null);

  const saved = await executeTemplateIntent({
    action: 'gathering.plan.save', key: planKey, submit: true,
    plan: { title: 'Workshop Keramik Akhir Tahun', invitePolicy: 'OPEN', optionKeys: [optionKey('opt-a')], rsvpCloseAt: '2026-12-10T23:59', paymentDueAt: '2026-12-15T23:59', scheduledAt: '2026-12-20T09:00' },
  }, context);
  assert.equal(saved.body.ok, true);
  assert.deepEqual(JSON.parse(api.calls.find(([method]) => method === 'PATCH')[2]), {
    title: 'Workshop Keramik Akhir Tahun', invite_policy: 'OPEN', opened_option_ids: ['opt-a'],
    reservation_deadline: '2026-12-10T16:59:00.000Z', payment_deadline: '2026-12-15T16:59:00.000Z', event_at: '2026-12-20T02:00:00.000Z', submit_plan: true,
  });
  const incomplete = await executeTemplateIntent({ action: 'gathering.plan.save', key: planKey, submit: true, plan: { title: 'Workshop' } }, context);
  assert.equal(incomplete.status, 422);

  const forged = await executeTemplateIntent({ action: 'gathering.cancel', key: createPageKeyFactory('user-2', 'test-secret', 'test')(PLAN_KEY_KINDS.plan, 'plan-1') }, context);
  assert.equal(forged.status, 409);
  const wrongStep = await executeTemplateIntent({ action: 'gathering.reservations.confirm', key: planKey }, context);
  assert.equal(wrongStep.status, 409);

  plan = planBase({ workflow_step: 'PAYMENT_CONFIRMATION', status: 'PAYMENT_OPEN' });
  const checkout = await executeTemplateIntent({
    action: 'gathering.registrations.checkout', key: planKey, keys: [key(PLAN_KEY_KINDS.registration, 'reg-2')],
  }, context);
  assert.deepEqual(checkout.body, { ok: true, redirect: 'https://pay.test/c/1' });
  const paidAgain = await executeTemplateIntent({
    action: 'gathering.registrations.checkout', key: planKey, keys: [key(PLAN_KEY_KINDS.registration, 'reg-1')],
  }, context);
  assert.equal(paidAgain.status, 409, 'peserta lunas tidak bisa dibayar ulang');

  const oneGroupTwice = await executeTemplateIntent({
    action: 'gathering.event.confirm', key: planKey, plan: { optionKeys: [optionKey('opt-a'), optionKey('opt-b')] },
  }, context);
  assert.equal(oneGroupTwice.status, 422);
  const notOpened = await executeTemplateIntent({
    action: 'gathering.event.confirm', key: planKey, plan: { optionKeys: [optionKey('opt-c')] },
  }, context);
  assert.equal(notOpened.status, 409);
  const backendRefused = await executeTemplateIntent({
    action: 'gathering.event.confirm', key: planKey, plan: { optionKeys: [optionKey('opt-a')] },
  }, context);
  assert.equal(backendRefused.status, 422);
  assert.equal(backendRefused.body.message, 'Peserta belum lunas');
  assert.deepEqual(JSON.parse(api.calls.findLast(([, path]) => path.includes('confirm-event'))[2]), {
    final_selections: [{ option_group_key: 'Sesi', option_id: 'opt-a' }],
  });

  const cancelled = await executeTemplateIntent({ action: 'gathering.cancel', key: planKey, reason: 'Hujan' }, context);
  assert.equal(cancelled.body.ok, true);
});

test('gathering plan exposes option and final venue location with Google Maps links only', async () => {
  const { buildGatheringPlanPage, googleMapsUrl } = await import('../lib/template-pages.ts');
  const plan = planBase();
  plan.occurrence.option_groups_snapshot = [
    { product_option_id: 'opt-a', option_group_key: 'Sesi', label: 'Sesi pagi', venue_location: 'Studio Tanah', venue_address: 'Jl. Kemang Raya 12', venue_map_url: 'https://maps.app.goo.gl/AbC123', is_final_selection: true, images: ['https://cdn.example/sesi-pagi.jpg', 'https://cdn.example/2.jpg'] },
    { product_option_id: 'opt-b', option_group_key: 'Sesi', label: 'Sesi siang', venue_location: 'Lain', venue_map_url: 'https://evil.test/maps', images: ['http://cdn.example/x.jpg'] },
  ];
  const page = buildGatheringPlanPage(plan, [], { key, viewerRole: 'initiator' });
  assert.deepEqual(validateTemplatePage(page), []);
  assert.equal(page.plan.occurrence.location, 'Studio Tanah');
  assert.equal(page.plan.occurrence.locationAddress, 'Jl. Kemang Raya 12');
  assert.equal(page.plan.occurrence.locationMapUrl, 'https://maps.app.goo.gl/AbC123');
  assert.equal(page.plan.occurrence.options[0].address, 'Jl. Kemang Raya 12');
  assert.equal(page.plan.occurrence.options[1].mapUrl, undefined, 'tautan non-Google Maps dibuang');
  assert.equal(page.plan.occurrence.options[0].imageUrl, 'https://cdn.example/sesi-pagi.jpg', 'gambar pertama opsi');
  assert.deepEqual(page.plan.occurrence.options[0].images, ['https://cdn.example/sesi-pagi.jpg', 'https://cdn.example/2.jpg']);
  assert.equal(page.plan.occurrence.options[1].images, undefined, 'tanpa gambar https → tidak dikirim');
  assert.equal(page.plan.occurrence.options[1].imageUrl, undefined, 'gambar non-https dibuang');

  // Keterangan rich text: teks polos untuk semua template + HTML tersanitasi opsional.
  plan.occurrence.option_groups_snapshot[0].description = '<p>Termasuk <strong>makan siang</strong> &amp; snack</p><ul><li>Kopi</li></ul>';
  plan.occurrence.option_groups_snapshot[1].description = 'Teks lama\nbaris dua';
  const rich = buildGatheringPlanPage(plan, [], { key, viewerRole: 'initiator' });
  assert.deepEqual(validateTemplatePage(rich), []);
  assert.equal(rich.plan.occurrence.options[0].description, 'Termasuk makan siang & snack\n• Kopi');
  assert.equal(rich.plan.occurrence.options[0].descriptionHtml, '<p>Termasuk <strong>makan siang</strong> &amp; snack</p><ul><li>Kopi</li></ul>');
  assert.equal(rich.plan.occurrence.options[1].description, 'Teks lama\nbaris dua');
  assert.equal(rich.plan.occurrence.options[1].descriptionHtml, undefined, 'teks polos lama tidak dikirim sebagai HTML');
  const unsafe = structuredClone(rich);
  unsafe.plan.occurrence.options[0].descriptionHtml = '<p onclick="x()">a</p>';
  assert.deepEqual(validateTemplatePage(unsafe), ['page.plan.occurrence.options[0].descriptionHtml: harus HTML tersanitasi ≤ 20000 karakter']);
  assert.equal(googleMapsUrl('https://www.google.com/maps/place/x'), 'https://www.google.com/maps/place/x');
  assert.deepEqual(
    validateTemplatePage({ ...page, plan: { ...page.plan, occurrence: { ...page.plan.occurrence, locationMapUrl: 'https://evil.test' } } }),
    ['page.plan.occurrence.locationMapUrl: harus tautan Google Maps https'],
  );
});

test('gathering plan exposes invitation banner/description and saves them via content intent', async () => {
  const { buildGatheringPlanPage, executeTemplateIntent, PLAN_KEY_KINDS } = await import('../lib/template-pages.ts');
  const withContent = planBase({
    workflow_step: 'INVITATIONS',
    invitation_banner_url: 'https://assets.example/banner.jpg',
    invitation_description: '  Berkumpul bersama keluarga.  ',
  });
  const page = buildGatheringPlanPage(withContent, [], { key, viewerRole: 'initiator' });
  assert.deepEqual(validateTemplatePage(page), []);
  assert.equal(page.plan.invitationBannerUrl, 'https://assets.example/banner.jpg');
  assert.equal(page.plan.invitationDescription, 'Berkumpul bersama keluarga.');
  const rich = buildGatheringPlanPage(planBase({
    workflow_step: 'INVITATIONS',
    invitation_description: '<p>Berkumpul <strong>bersama</strong> keluarga.</p><ul><li>Bawa topi</li></ul>',
  }), [], { key, viewerRole: 'initiator' });
  assert.equal(rich.plan.invitationDescription, 'Berkumpul bersama keluarga.\n• Bawa topi');
  assert.equal(rich.plan.invitationDescriptionHtml, '<p>Berkumpul <strong>bersama</strong> keluarga.</p><ul><li>Bawa topi</li></ul>');
  assert.equal(page.plan.invitationDescriptionHtml, undefined, 'teks polos lama tidak dikirim sebagai HTML');
  const insecure = buildGatheringPlanPage(planBase({ invitation_banner_url: 'http://assets.example/b.jpg' }), [], { key, viewerRole: 'initiator' });
  assert.equal(insecure.plan.invitationBannerUrl, undefined);
  assert.deepEqual(
    validateTemplatePage({ ...page, plan: { ...page.plan, invitationBannerUrl: 'javascript:alert(1)' } }),
    ['page.plan.invitationBannerUrl: harus URL gambar https'],
  );

  let plan = withContent;
  const uploads = [];
  const api = fakeApi({
    'GET /api/gathering/plans': () => ({ data: [{ id: 'plan-1' }], status: 200 }),
    'GET /api/gathering/plans/plan-1': () => ({ data: plan, status: 200 }),
    'PATCH /api/gathering/plans/plan-1/invitation-content': () => (failPatch ? { data: { message: 'Banner tidak valid' }, status: 400 } : { data: {}, status: 200 }),
    'POST /api/gathering/plans/plan-1/invitations/submit': () => ({ data: {}, status: 200 }),
  });
  let failPatch = false;
  const context = {
    pageType: 'gathering_plan', websiteId: 'w1', basePath: '/toko', key, fetch: api.fetch,
    upload: async (path, form) => {
      uploads.push([path, form.get('file')]);
      return { data: { url: 'https://assets.example/new.jpg' }, status: 201 };
    },
  };
  const planKey = key(PLAN_KEY_KINDS.plan, 'plan-1');
  const patches = () => api.calls.filter(([method]) => method === 'PATCH').map(([, , body]) => JSON.parse(body));

  const banner = new Blob(['img'], { type: 'image/png' });
  const saved = await executeTemplateIntent({
    action: 'gathering.invitation.content.save', key: planKey,
    invitationContent: { description: 'Halo semua' }, bannerFile: banner,
  }, context);
  assert.equal(saved.body.ok, true);
  assert.equal(uploads[0][0], '/api/gathering/plans/plan-1/invitation-banner?website_id=w1');
  assert.equal(await uploads[0][1].text(), 'img');
  assert.deepEqual(patches()[0], { invitation_description: 'Halo semua', invitation_banner_url: 'https://assets.example/new.jpg' });

  await executeTemplateIntent({ action: 'gathering.invitation.content.save', key: planKey, invitationContent: { description: '' } }, context);
  assert.deepEqual(patches()[1], { invitation_description: null }, 'tanpa file banner lama dipertahankan');
  await executeTemplateIntent({ action: 'gathering.invitation.content.save', key: planKey, invitationContent: { description: 'x', removeBanner: true } }, context);
  assert.deepEqual(patches()[2], { invitation_description: 'x', invitation_banner_url: null });

  // Kirim undangan menyimpan tampilan undangan dulu (bila ikut dikirim), baru submit.
  const callOrder = () => api.calls.filter(([method]) => method !== 'GET').map(([method, path]) => `${method} ${path.split('?')[0]}`);
  const before = api.calls.length;
  const submitted = await executeTemplateIntent({
    action: 'gathering.invitations.submit', key: planKey, invitationContent: { description: '<p>Final</p>' },
  }, context);
  assert.equal(submitted.body.ok, true);
  assert.deepEqual(callOrder().slice(-2), ['PATCH /api/gathering/plans/plan-1/invitation-content', 'POST /api/gathering/plans/plan-1/invitations/submit']);
  assert.deepEqual(patches().at(-1), { invitation_description: '<p>Final</p>' });
  // Tanpa isi tampilan: langsung submit.
  await executeTemplateIntent({ action: 'gathering.invitations.submit', key: planKey }, context);
  assert.equal(callOrder().at(-1), 'POST /api/gathering/plans/plan-1/invitations/submit');
  // Simpan gagal → undangan tidak dikirim.
  failPatch = true;
  const submitsBefore = api.calls.filter(([, path]) => path.includes('/invitations/submit')).length;
  const failed = await executeTemplateIntent({
    action: 'gathering.invitations.submit', key: planKey, invitationContent: { description: 'x' },
  }, context);
  assert.equal(failed.status, 422);
  assert.equal(failed.body.message, 'Banner tidak valid');
  assert.equal(api.calls.filter(([, path]) => path.includes('/invitations/submit')).length, submitsBefore, 'submit tidak dipanggil');
  assert.ok(api.calls.length > before);
  failPatch = false;

  plan = { ...withContent, workflow_step: 'INVITATION_CONFIRMATION' };
  const stale = await executeTemplateIntent({ action: 'gathering.invitation.content.save', key: planKey, invitationContent: { description: 'x' } }, context);
  assert.equal(stale.status, 409);
});

test('rich text helpers stay in sync between template-pages and the client-safe lib', async () => {
  const pages = await import('../lib/template-pages.ts');
  const lib = await import('../lib/rich-text.ts');
  const samples = [
    '<p>Makan &amp; minum</p><ul><li>Kopi</li><li>Teh</li></ul>',
    '<p>a<br>b</p><p>&#128512; &#x1F600; &nbsp;x</p>',
    'teks polos\nbaris dua',
    '<p></p>',
    '',
    null,
  ];
  for (const sample of samples) {
    assert.equal(pages.richTextToPlainText(sample), lib.richTextToPlainText(sample));
    assert.equal(pages.richTextHtml(sample), lib.richTextHtml(sample));
  }
});

const gatheringProduct = (overrides = {}) => ({
  id: 'prod-1',
  type: 'gathering',
  name: 'Study Tour Bandung',
  slug: 'study-tour-bandung',
  category: 'Study tour',
  description: '<p>Perjalanan <strong>edukatif</strong>.</p>',
  detail: '<h2>Itinerary</h2><p>Berangkat 07.00</p>',
  priceLabel: 'Rp 350.000',
  image: 'https://cdn.example/cover.jpg',
  images: ['https://cdn.example/cover.jpg', 'http://cdn.example/insecure.jpg', 'https://cdn.example/2.jpg'],
  specifications: { Durasi: '1 hari', Kosong: '' },
  gatheringMeta: {
    eventDate: 'Sabtu, 20 Des',
    eventTime: '07.00',
    location: 'Bandung',
    minAttendees: 20,
    maxAttendees: 45,
    depositAmountPerSeat: 100000,
    optionGroups: [
      { key: 'konsumsi', label: 'Konsumsi', options: [
        { id: 'opt-b', label: 'Snack', description: 'Snack box', images: ['https://cdn.example/snack.jpg'], benefits: ['Air mineral'] },
        { id: 'opt-a', label: 'Nasi kotak', description: 'Nasi', descriptionHtml: '<p>Nasi <em>hangat</em></p>' },
      ] },
      { key: 'lokasi', label: 'Lokasi', options: [
        { id: 'opt-c', label: 'Museum', venueLocation: 'Museum Geologi', venueAddress: 'Jl. Diponegoro 57', venueMapUrl: 'https://maps.app.goo.gl/Museum' },
      ] },
    ],
  },
  ...overrides,
});

test('product detail page exposes gathering options in data order with public keys', async () => {
  const { buildProductDetailPage, createPageKeyFactory, PUBLIC_PAGE_KEY_SCOPE } = await import('../lib/template-pages.ts');
  const publicKey = createPageKeyFactory(PUBLIC_PAGE_KEY_SCOPE, 'test-secret', 'test');
  const related = [gatheringProduct(), gatheringProduct({ id: 'prod-2', slug: 'outbound', name: 'Outbound' }), gatheringProduct({ id: 'prod-3', type: 'product' })];
  const page = buildProductDetailPage(gatheringProduct(), related, { key: publicKey, basePath: '/toko', loggedIn: false });
  assert.deepEqual(validateTemplatePage(page), []);
  assert.equal(page.product.key, publicKey('product', 'prod-1'));
  assert.deepEqual(page.product.images, ['https://cdn.example/cover.jpg', 'https://cdn.example/2.jpg'], 'gambar https saja, tanpa duplikat');
  assert.equal(page.product.descriptionHtml, '<p>Perjalanan <strong>edukatif</strong>.</p>');
  assert.equal(page.product.description, 'Perjalanan edukatif.');
  assert.equal(page.product.gathering.depositAmount, 100000);
  assert.equal(page.product.gathering.eventDateLabel, 'Sabtu, 20 Des · 07.00');
  // Urutan kelompok & opsi = urutan data (Snack sebelum Nasi kotak, tidak diurutkan abjad).
  assert.deepEqual(page.product.gathering.optionGroups.map((group) => group.label), ['Konsumsi', 'Lokasi']);
  assert.deepEqual(page.product.gathering.optionGroups[0].options.map((option) => option.label), ['Snack', 'Nasi kotak']);
  assert.equal(page.product.gathering.optionGroups[0].options[0].imageUrl, 'https://cdn.example/snack.jpg');
  assert.equal(page.product.gathering.optionGroups[0].options[1].descriptionHtml, '<p>Nasi <em>hangat</em></p>');
  assert.equal(page.product.gathering.optionGroups[1].options[0].mapUrl, 'https://maps.app.goo.gl/Museum');
  assert.deepEqual(page.product.specifications, [{ label: 'Durasi', value: '1 hari' }]);
  assert.deepEqual(page.related.map((item) => item.href), ['/toko/products/outbound'], 'hanya gathering lain');
  assert.deepEqual(page.actions, ['gathering.plan.create', 'product.chat.open']);
});

test('product detail intents create a plan or a product chat for the keyed product', async () => {
  const { executeTemplateIntent, createPageKeyFactory, PUBLIC_PAGE_KEY_SCOPE } = await import('../lib/template-pages.ts');
  const publicKey = createPageKeyFactory(PUBLIC_PAGE_KEY_SCOPE, 'test-secret', 'test');
  const api = fakeApi({
    'POST /api/gathering/plans': () => ({ data: { id: 'plan-9', order_id: 'order-9' }, status: 201 }),
    'POST /api/chat/w1/customer-threads': () => ({ data: { data: { id: 'thread-9' } }, status: 201 }),
  });
  const context = {
    pageType: 'product_detail', websiteId: 'w1', basePath: '/toko', key, publicKey, fetch: api.fetch,
    products: [gatheringProduct(), gatheringProduct({ id: 'prod-x', type: 'product', name: 'Kaos' })],
  };

  const plan = await executeTemplateIntent({ action: 'gathering.plan.create', key: publicKey('product', 'prod-1') }, context);
  assert.deepEqual(plan.body, { ok: true, redirect: '/toko/cart/order/order-9' });
  assert.deepEqual(JSON.parse(api.calls.find(([, path]) => path === '/api/gathering/plans')[2]), { website_id: 'w1', product_id: 'prod-1' });

  const chat = await executeTemplateIntent({ action: 'product.chat.open', key: publicKey('product', 'prod-1') }, context);
  assert.deepEqual(chat.body, { ok: true, redirect: '/toko/chat?thread=thread-9' });
  const chatBody = JSON.parse(api.calls.find(([, path]) => path === '/api/chat/w1/customer-threads')[2]);
  assert.equal(chatBody.channel_type, 'product');
  assert.equal(chatBody.product_id, 'prod-1');
  assert.match(chatBody.initial_message, /^__BAGDJA_CHAT_REFERENCE__\{"type":"product","id":"prod-1"/);

  assert.equal((await executeTemplateIntent({ action: 'gathering.plan.create', key: publicKey('product', 'prod-x') }, context)).status, 422, 'bukan gathering');
  assert.equal((await executeTemplateIntent({ action: 'gathering.plan.create', key: 'kTidakAda000000' }, context)).status, 409);
  assert.equal((await executeTemplateIntent({ action: 'gathering.plan.create', key: publicKey('product', 'prod-1') }, { ...context, pageType: 'cart' })).status, 403);
});

const invitationPreview = (overrides = {}) => ({
  invitation: { invitee_name: null, invitee_email_masked: null, expires_at: '2026-12-30T00:00:00Z' },
  group: { title: 'Bukber 2026', plan_number: 'KMPL-1', initiator_name: 'Nandang', invite_policy: 'OPEN', invitation_banner_url: 'https://cdn.example/b.jpg', invitation_description: '<p>Ayo <strong>datang</strong></p>' },
  occurrence: {
    status: 'RSVP_OPEN',
    price_per_seat: '250000',
    min_attendees: 10,
    max_attendees: 40,
    final_schedule: '2026-12-20T12:00:00Z',
    rsvp_close_at: '2099-12-10T16:59:00Z',
    cancellation_policy_snapshot: { participant_terms: '<p>DP tidak kembali</p>' },
    voting_results: { paket: { total_votes: 3, options: { 'opt-a': { votes: 2, percentage: 67 }, 'opt-b': { votes: 1, percentage: 33 } } } },
    options: [
      { product_option_id: 'opt-a', option_group_key: 'paket', label: 'Liwet', description: '<p>Nasi <em>liwet</em></p>', images: ['https://cdn.example/a.jpg'] },
      { product_option_id: 'opt-b', option_group_key: 'paket', label: 'Kafe' },
    ],
  },
  ...overrides,
});

test('gathering invitation page exposes viewer states with public keys', async () => {
  const { buildGatheringInvitationPage, createPageKeyFactory, PUBLIC_PAGE_KEY_SCOPE } = await import('../lib/template-pages.ts');
  const publicKey = createPageKeyFactory(PUBLIC_PAGE_KEY_SCOPE, 'test-secret', 'test');
  const options = { key: publicKey, token: 'tok-1', pagePath: '/toko/gathering/invite/tok-1', loggedIn: false };

  const guestForm = buildGatheringInvitationPage(invitationPreview(), options);
  assert.deepEqual(validateTemplatePage(guestForm), []);
  assert.equal(guestForm.viewer.state, 'guest_form');
  assert.deepEqual(guestForm.viewer.form, { askName: true, askContact: true, askWhatsapp: true, whatsappRequired: false });
  assert.deepEqual(guestForm.actions, ['gathering.invitation.rsvp']);
  assert.equal(guestForm.invitation.key, publicKey('gathering_invitation', 'tok-1'));
  assert.equal(guestForm.invitation.seatPrice, 250000);
  assert.equal(guestForm.invitation.descriptionHtml, '<p>Ayo <strong>datang</strong></p>');
  assert.equal(guestForm.invitation.terms, 'DP tidak kembali');
  assert.equal(guestForm.optionGroups[0].totalVotes, 3);
  assert.deepEqual(guestForm.optionGroups[0].options.map((option) => [option.label, option.votes, option.percentage]), [['Liwet', 2, 67], ['Kafe', 1, 33]]);
  assert.equal(guestForm.optionGroups[0].options[0].imageUrl, 'https://cdn.example/a.jpg');
  assert.equal(guestForm.loginHref, '/auth/login?next=%2Ftoko%2Fgathering%2Finvite%2Ftok-1');

  const pending = buildGatheringInvitationPage(invitationPreview(), {
    ...options,
    guest: { pending: { reservationId: 'r1', contact: 'dewi@example.com', name: 'Dewi', options: { paket: 'opt-b' }, expiresAt: '2099-01-01T00:00:00Z' } },
  });
  assert.equal(pending.viewer.state, 'otp_pending');
  assert.equal(pending.viewer.otpDestination, 'de•••@example.com');
  assert.deepEqual(pending.actions, ['gathering.invitation.rsvp', 'gathering.invitation.verify_otp', 'gathering.invitation.resend_otp']);
  assert.equal(pending.optionGroups[0].options[1].selected, true);
  assert.deepEqual(validateTemplatePage(pending), [], 'tanpa field email/token di page');

  const paying = buildGatheringInvitationPage(invitationPreview({ occurrence: { ...invitationPreview().occurrence, status: 'PAYMENT_OPEN' } }), {
    ...options, loggedIn: true, guest: { registrationId: 'reg-1', selectedOptions: { paket: 'opt-a' } }, paymentStatus: 'UNPAID',
  });
  assert.equal(paying.viewer.state, 'registered');
  const withAttendee = buildGatheringInvitationPage(invitationPreview(), {
    ...options, guest: { registrationId: 'reg-1', attendee: { name: 'Dewi', contactMasked: 'de•••@example.com', phoneMasked: '+6281••••••890' } },
  });
  assert.deepEqual(withAttendee.viewer.attendee, { name: 'Dewi', contact: 'de•••@example.com', phone: '+6281••••••890' });
  assert.deepEqual(validateTemplatePage(withAttendee), []);
  assert.equal(paying.viewer.canPay, true);
  assert.deepEqual(paying.actions, ['gathering.invitation.pay']);

  const privatePreview = invitationPreview({ group: { ...invitationPreview().group, invite_policy: 'INVITE_ONLY' } });
  assert.equal(buildGatheringInvitationPage(privatePreview, options).viewer.state, 'login_required');
  const mismatch = buildGatheringInvitationPage(privatePreview, {
    ...options, loggedIn: true,
    privateStatus: { invitation: { account_matches: false, account_email: 'lain@example.com', requires_attendee_name: false, requires_whatsapp: false } },
  });
  assert.equal(mismatch.viewer.state, 'account_mismatch');
  assert.equal(mismatch.viewer.accountLabel, 'la•••@example.com');
  const privateForm = buildGatheringInvitationPage(privatePreview, {
    ...options, loggedIn: true,
    privateStatus: { invitation: { account_matches: true, requires_attendee_name: true, requires_whatsapp: true } },
  });
  assert.deepEqual(privateForm.viewer.form, { askName: true, askContact: false, askWhatsapp: true, whatsappRequired: true });
  assert.deepEqual(validateTemplatePage(privateForm), []);
});

test('gathering invitation intents run open RSVP with OTP via cookie and private RSVP via session', async () => {
  const {
    executeTemplateIntent, createPageKeyFactory, PUBLIC_PAGE_KEY_SCOPE, decodeInvitationGuestState, invitationCookieName,
  } = await import('../lib/template-pages.ts');
  const publicKey = createPageKeyFactory(PUBLIC_PAGE_KEY_SCOPE, 'test-secret', 'test');
  let preview = invitationPreview();
  const pub = fakeApi({
    'GET /api/public/gathering-invitations/tok-1': () => ({ data: preview, status: 200 }),
    'POST /api/public/gathering-invitations/tok-1/rsvp': () => ({ data: { reservation_id: 'res-1', expires_at: '2099-01-01T00:00:00Z' }, status: 201 }),
    'POST /api/public/gathering-invitations/tok-1/verify-otp': (init) => (JSON.parse(init.body).code === '123456'
      ? { data: { id: 'reg-9', selected_options: { paket: 'opt-a' } }, status: 201 }
      : { data: null, status: 400, error: '{"message":"Kode verifikasi tidak valid."}' }),
  });
  const auth = fakeApi({
    'POST /api/public/gathering-invitations/tok-1/private-rsvp': () => ({ data: { id: 'reg-p' }, status: 201 }),
    'POST /api/gathering/registrations/reg-9/seat-order': () => ({ data: { id: 'seat-1', checkout_url: 'https://pay.test/s/1' }, status: 201 }),
  });
  const invitationKey = publicKey('gathering_invitation', 'tok-1');
  const context = {
    pageType: 'gathering_invitation', websiteId: 'w1', basePath: '/toko', key, publicKey,
    fetch: auth.fetch, publicFetch: pub.fetch, invitationToken: 'tok-1', invitationGuest: {},
  };

  const rsvp = await executeTemplateIntent({
    action: 'gathering.invitation.rsvp', key: invitationKey,
    rsvp: { attendeeName: 'Dewi', contact: 'Dewi@Example.com', optionKeys: [publicKey('gathering_invitation_option', 'opt-a')] },
  }, context);
  assert.equal(rsvp.body.ok, true);
  assert.deepEqual(JSON.parse(pub.calls.find(([, path]) => path.endsWith('/rsvp'))[2]), { attendee_name: 'Dewi', email: 'dewi@example.com', selected_options: { paket: 'opt-a' } });
  assert.equal(rsvp.cookie.name, invitationCookieName('tok-1'));
  const pendingState = decodeInvitationGuestState(rsvp.cookie.value);
  assert.equal(pendingState.pending.reservationId, 'res-1');

  const wrong = await executeTemplateIntent({ action: 'gathering.invitation.verify_otp', key: invitationKey, code: '000000' }, { ...context, invitationGuest: pendingState });
  assert.equal(wrong.status, 422);
  assert.equal(wrong.body.message, 'Kode verifikasi tidak valid.');
  const verified = await executeTemplateIntent({ action: 'gathering.invitation.verify_otp', key: invitationKey, code: '123456' }, { ...context, invitationGuest: pendingState });
  assert.deepEqual(decodeInvitationGuestState(verified.cookie.value), {
    registrationId: 'reg-9',
    selectedOptions: { paket: 'opt-a' },
    attendee: { name: 'Dewi', contactMasked: 'de•••@example.com' },
  }, 'hanya kontak tersamar yang disimpan');

  const pay = await executeTemplateIntent({ action: 'gathering.invitation.pay', key: invitationKey }, { ...context, invitationGuest: { registrationId: 'reg-9' } });
  assert.deepEqual(pay.body, { ok: true, redirect: 'https://pay.test/s/1' });

  assert.equal((await executeTemplateIntent({ action: 'gathering.invitation.rsvp', key: 'kSalah0000000', rsvp: {} }, context)).status, 409, 'key harus terikat token');
  assert.equal((await executeTemplateIntent({
    action: 'gathering.invitation.rsvp', key: invitationKey, rsvp: { optionKeys: ['kTidakAda0000'] },
  }, context)).status, 409);

  preview = invitationPreview({ group: { ...invitationPreview().group, invite_policy: 'INVITE_ONLY' } });
  const privateRsvp = await executeTemplateIntent({ action: 'gathering.invitation.rsvp', key: invitationKey, rsvp: { whatsapp: '+628123456789' } }, context);
  assert.equal(privateRsvp.body.ok, true);
  assert.deepEqual(JSON.parse(auth.calls.find(([, path]) => path.endsWith('/private-rsvp'))[2]), { whatsapp: '+628123456789', selected_options: {} });
  assert.equal(privateRsvp.cookie, undefined, 'undangan khusus tanpa cookie tamu');
});
