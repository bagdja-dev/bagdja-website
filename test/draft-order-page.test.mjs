import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateTemplatePage } from '../lib/template-page-contract.ts';
import { buildDraftOrderPage, createPageKeyFactory, executeTemplateIntent } from '../lib/template-pages.ts';

const key = createPageKeyFactory('buyer-1', 'test-secret', 'test');
const ORDER_ID = '11111111-2222-4333-8444-555555555555';

function draftOrder(overrides = {}) {
  return {
    id: ORDER_ID,
    status: 'PENDING',
    quantity: 2,
    unit_price: '250000',
    total_amount: '500000',
    quoted_total_amount: null,
    payment_mode: 'CHECKOUT',
    created_at: '2026-11-15T03:20:00.000Z',
    transaction_id: null,
    product: { id: 'p1', name: 'Road Trip Pangandaran', slug: 'road-trip', images: ['https://cdn.test/a.jpg'], quotable: true, uom: { symbol: 'hari' } },
    praorderProgress: {
      steps: [
        { stepName: 'Detail', filledBy: 'buyer', description: null, completed: true, formData: { tujuan: 'Pangandaran' },
          formSchema: [{ key: 'tujuan', label: 'Tujuan', type: 'text', required: true }] },
        { stepName: 'Jadwal', filledBy: 'buyer', description: 'Isi jadwal', completed: false,
          formData: { foto: [{ url: 'https://cdn.test/f1.jpg', description: '' }] },
          formSchema: [
            { key: 'tanggal', label: 'Tanggal berangkat', type: 'tanggal', required: true },
            { key: 'jemput', label: 'Titik jemput', type: 'lokasi', required: false },
            { key: 'armada', label: 'Armada', type: 'select', required: false, options: ['Elf', 'Bus'] },
            { key: 'foto', label: 'Foto', type: 'foto', required: false, max_files: 2 },
          ] },
        { stepName: 'Survei', filledBy: 'admin', description: null, completed: false, formData: null, formSchema: [] },
      ],
    },
    quoteTermins: null,
    ...overrides,
  };
}

const basePath = '/toko';

test('draft order page satisfies the template contract and reflects praorder progress', () => {
  const page = buildDraftOrderPage(draftOrder(), { basePath, key });
  assert.deepEqual(validateTemplatePage(page), []);
  assert.equal(page.order.awaitingQuote, true);
  assert.equal('totalAmount' in page.order, false, 'no total while waiting for the quote');
  assert.equal(page.order.statusLabel, 'Lengkapi data pesanan');
  assert.deepEqual(page.steps.map((step) => [step.state, step.editable]), [['done', false], ['current', true], ['locked', false]]);
  assert.deepEqual(page.steps[1].fields.find((field) => field.name === 'foto').files, [{ url: 'https://cdn.test/f1.jpg', description: '' }]);
  assert.equal(page.canPay, false);
  assert.equal(page.quote, null);

  const quoted = buildDraftOrderPage(draftOrder({
    quoted_total_amount: '780000',
    praorderProgress: { steps: [] },
    quoteTermins: [{ label: 'DP', amount: 300000 }, { label: 'Pelunasan', amount: 480000 }],
  }), { basePath, key });
  assert.deepEqual(validateTemplatePage(quoted), []);
  assert.equal(quoted.order.totalAmount, 780000);
  assert.equal(quoted.order.quantityLocked, true);
  assert.equal(quoted.canPay, true);
  assert.deepEqual(quoted.quote.termins, [{ label: 'DP', amount: 300000 }, { label: 'Pelunasan', amount: 480000 }]);
});

function intentContext(order, calls) {
  return {
    pageType: 'draft_order',
    websiteId: 'web-1',
    basePath,
    key,
    draftOrderId: ORDER_ID,
    fetch: async (path, init = {}) => {
      calls.push({ path, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });
      if (path === `/api/orders/${ORDER_ID}` && !init.method) return { status: 200, data: order };
      if (path.includes('customer-threads')) return { status: 201, data: { data: { id: 'thread-1' } } };
      return { status: 200, data: { ok: true } };
    },
    upload: async (path) => {
      calls.push({ path, method: 'UPLOAD' });
      return { status: 200, data: { url: 'https://cdn.test/new.jpg' } };
    },
  };
}

test('draft order intents save, submit, upload, and remove praorder data on the current buyer step', async () => {
  const order = draftOrder();
  const page = buildDraftOrderPage(order, { basePath, key });
  const step = page.steps[1].key;
  const calls = [];
  const context = intentContext(order, calls);

  const saved = await executeTemplateIntent({ action: 'order.praorder.save', key: page.order.key, step, values: { tanggal: '2026-12-20', jemput: '-7.6, 108.6' } }, context);
  assert.equal(saved.status, 200);
  const draftCall = calls.find((call) => call.path.endsWith('/steps/draft'));
  assert.deepEqual(draftCall.body, {
    step_name: 'Jadwal',
    form_data: { foto: [{ url: 'https://cdn.test/f1.jpg', description: '' }], tanggal: '2026-12-20', jemput: '-7.6, 108.6' },
  }, 'saving keeps uploaded files');

  const invalid = await executeTemplateIntent({ action: 'order.praorder.save', key: page.order.key, step, values: { armada: 'Kapal' } }, context);
  assert.equal(invalid.status, 422);

  const missing = await executeTemplateIntent({ action: 'order.praorder.submit', key: page.order.key, step, values: {} }, context);
  assert.equal(missing.status, 422);
  assert.match(missing.body.message, /Tanggal berangkat wajib diisi/);

  calls.length = 0;
  const submitted = await executeTemplateIntent({ action: 'order.praorder.submit', key: page.order.key, step, values: { tanggal: '2026-12-20' } }, context);
  assert.equal(submitted.status, 200);
  assert.ok(calls.some((call) => call.path.endsWith('/steps/complete') && call.body.form_data.tanggal === '2026-12-20'));

  calls.length = 0;
  const file = new File([new Uint8Array([1, 2, 3])], 'rombongan.jpg', { type: 'image/jpeg' });
  const uploaded = await executeTemplateIntent({ action: 'order.praorder.upload', key: page.order.key, step, target: 'foto', bannerFile: file }, context);
  assert.equal(uploaded.status, 200);
  assert.ok(calls.some((call) => call.method === 'UPLOAD' && call.path.endsWith('/fulfillment-assets')));
  assert.equal(calls.find((call) => call.path.endsWith('/steps/draft')).body.form_data.foto.length, 2);

  const wrongType = await executeTemplateIntent({ action: 'order.praorder.upload', key: page.order.key, step, target: 'foto',
    bannerFile: new File([new Uint8Array([1])], 'a.pdf', { type: 'application/pdf' }) }, context);
  assert.equal(wrongType.status, 422);

  calls.length = 0;
  const removed = await executeTemplateIntent({ action: 'order.praorder.file.remove', key: page.order.key, step, target: 'foto', index: 0 }, context);
  assert.equal(removed.status, 200);
  assert.deepEqual(calls.find((call) => call.path.endsWith('/steps/draft')).body.form_data.foto, []);

  const lockedStep = await executeTemplateIntent({ action: 'order.praorder.save', key: page.order.key, step: page.steps[2].key, values: {} }, context);
  assert.equal(lockedStep.status, 409);
});

test('draft order intents reject a forged key and handle quantity, pay, cancel, and chat', async () => {
  const order = draftOrder();
  const page = buildDraftOrderPage(order, { basePath, key });
  const calls = [];
  const context = intentContext(order, calls);

  const forged = await executeTemplateIntent({ action: 'order.draft.cancel', key: 'forgedKey000001' }, context);
  assert.equal(forged.status, 409);
  assert.equal(calls.length, 0);

  assert.equal((await executeTemplateIntent({ action: 'order.quantity.set', key: page.order.key, quantity: 3 }, context)).status, 200);
  assert.ok(calls.some((call) => call.method === 'PATCH' && call.body.quantity === 3));

  const notPayable = await executeTemplateIntent({ action: 'order.draft.pay', key: page.order.key }, context);
  assert.equal(notPayable.status, 409);

  const cancelled = await executeTemplateIntent({ action: 'order.draft.cancel', key: page.order.key }, context);
  assert.deepEqual(cancelled.body, { ok: true, redirect: '/toko/orders' });

  const chat = await executeTemplateIntent({ action: 'order.chat.open', key: page.order.key }, context);
  assert.deepEqual(chat.body, { ok: true, redirect: '/toko/chat?thread=thread-1' });

  const quotedOrder = draftOrder({ quoted_total_amount: 780000, praorderProgress: { steps: [] } });
  const quotedPage = buildDraftOrderPage(quotedOrder, { basePath, key });
  const quotedContext = intentContext(quotedOrder, []);
  const pay = await executeTemplateIntent({ action: 'order.draft.pay', key: quotedPage.order.key }, quotedContext);
  assert.deepEqual(pay.body, { ok: true, redirect: `/toko/checkout?order_ids=${ORDER_ID}` });
  const lockedQuantity = await executeTemplateIntent({ action: 'order.quantity.set', key: quotedPage.order.key, quantity: 5 }, quotedContext);
  assert.equal(lockedQuantity.status, 409);
});
