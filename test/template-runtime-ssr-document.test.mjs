import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(currentDirectory, '..');
const require = createRequire(import.meta.url);
const helperSource = await readFile(join(projectRoot, 'lib/template-runtime-ssr-document.ts'), 'utf8');
const transpiled = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const helperModule = { exports: {} };
new Function('exports', 'module', 'require', transpiled)(
  helperModule.exports,
  helperModule,
  require,
);
const {
  GOOGLE_MAPS_PATTERN_SOURCE,
  BOOTSTRAP_INTENTS,
  createTemplateInlineBootstrap,
  createTemplateRuntimeSsrDocument,
  isTemplateRuntimePongMessage,
  isTemplateRuntimeResizeMessage,
  isTemplateRuntimeNotificationAnchorMessage,
} = helperModule.exports;
const identity = { slug: 'storefront-demo', version: '1.2.3', digest: 'a'.repeat(64) };
globalThis.window = { atob, btoa, crypto: webcrypto };
const bridgeSource = await readFile(join(projectRoot, 'lib/template-runtime-bridge.ts'), 'utf8');
const bridgeTranspiled = ts.transpileModule(bridgeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const bridgeModule = { exports: {} };
new Function('exports', 'module', 'require', bridgeTranspiled)(
  bridgeModule.exports,
  bridgeModule,
  require,
);
const {
  createTemplateRuntimeOrderActionBridge,
  getAllowedTemplateNavigationUrl,
  parseTemplateRuntimeOrderActionMessage,
  parseTemplateRuntimeIntentMessage,
  createTemplateRuntimeIntentBridge,
  TEMPLATE_RUNTIME_INTENTS,
  TEMPLATE_RUNTIME_INTENT_CONFIRMATIONS,
  GOOGLE_MAPS_NAVIGATION_URL,
  getAllowedTemplateShareUrl,
  parseTemplateRuntimeRefreshMessage,
  parseTemplateRuntimeShareMessage,
} = bridgeModule.exports;
const contractSource = await readFile(join(projectRoot, 'lib/template-page-contract.ts'), 'utf8');
const contractModule = { exports: {} };
new Function('exports', 'module', 'require', ts.transpileModule(contractSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(contractModule.exports, contractModule, require);
const browserBundleModule = { exports: {} };
new Function('exports', 'module', 'require', ts.transpileModule(
  await readFile(join(projectRoot, 'lib/template-browser-bundle.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText)(browserBundleModule.exports, browserBundleModule, require);
const runtimeClientSource = await readFile(join(projectRoot, 'lib/template-runtime-client.ts'), 'utf8');
const runtimeClientTranspiled = ts.transpileModule(runtimeClientSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const runtimeClientModule = { exports: {} };
new Function('exports', 'module', 'require', runtimeClientTranspiled)(
  runtimeClientModule.exports,
  runtimeClientModule,
  (specifier) => specifier.endsWith('template-runtime-bridge')
    ? bridgeModule.exports
    : specifier.endsWith('template-page-contract')
      ? contractModule.exports
      : specifier.endsWith('template-browser-bundle')
        ? browserBundleModule.exports
        : require(specifier),
);
const { sanitizeTemplateRuntimeProps, getTemplateClientRenderBundle } = runtimeClientModule.exports;
globalThis.DOMParser = class {
  parseFromString(markup) {
    const body = markup.match(/<body>([\s\S]*)<\/body>/i)?.[1]
      ?? markup.replace(/^.*?<body>/is, '');
    const sanitizedBody = body
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<(?:meta|base|iframe|frame|object|embed|form)\b[^>]*\/?>/gi, '')
      .replace(/<link\b(?=[^>]*\brel\s*=\s*['"]?import\b)[^>]*\/?>/gi, '');
    const elements = [];
    sanitizedBody.replace(/<([a-z][\w:-]*)\b([^>]*)>/gi, (whole, tagName, rawAttributes) => {
      const attributes = [];
      rawAttributes.replace(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g, (_attribute, name, doubleQuoted, singleQuoted, unquoted) => {
        attributes.push({ name, value: doubleQuoted ?? singleQuoted ?? unquoted ?? '' });
        return '';
      });
      const element = {
        tagName,
        attributes,
        removed: false,
        remove() {
          this.removed = true;
        },
        removeAttribute(name) {
          this.attributes = this.attributes.filter((attribute) => attribute.name !== name);
        },
        setAttribute(name, value) {
          this.removeAttribute(name);
          this.attributes.push({ name, value });
        },
      };
      elements.push(element);
      return whole;
    });
    return {
      body: {
        get innerHTML() {
          let index = 0;
          return sanitizedBody.replace(/<([a-z][\w:-]*)\b([^>]*)>/gi, (whole) => {
            const element = elements[index++];
            if (!element || element.removed) return '';
            const attrs = element.attributes.map(({ name, value }) =>
              ` ${name}="${String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"`,
            ).join('');
            return `<${element.tagName}${attrs}>`;
          });
        },
        querySelectorAll: (selector) => selector === '*' ? elements : [],
      },
      querySelectorAll: (selector) => {
        if (selector === '*') return elements;
        const removedTagNames = new Set(['script', 'meta', 'base', 'iframe', 'frame', 'object', 'embed', 'form']);
        return elements.filter((element) => removedTagNames.has(element.tagName.toLowerCase()));
      },
    };
  }
};

test('builds a static, CSP-locked frame and strips executable or navigation markup', async () => {
  const document = await createTemplateRuntimeSsrDocument({
    html: '<main>Rendered</main><script>window.pwned = true;</script><meta http-equiv="refresh" content="0;url=https://evil.test"><iframe src="https://evil.test"></iframe><a href="/store/products">Products</a>',
    identity,
    parentOrigin: 'https://tenant.example.test',
    tenantPathPrefix: '/store',
    stylesheetUrls: [
      'https://tenant.example.test/_next/static/css/site.css',
      'https://attacker.example.test/steal.css',
      'javascript:alert(1)',
    ],
  });
  const bootstrap = document.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(bootstrap);
  assert.doesNotThrow(() => new Function(bootstrap));
  // Tautan Google Maps dengan target="_blank" tetap diteruskan ke host (dicek sebelum `target`).
  const mapsCheck = bootstrap.indexOf("type: 'bagdja:template:navigate', ...identity, href: url.href }");
  const targetCheck = bootstrap.indexOf("if (target.target && target.target.toLowerCase() !== '_self') return;");
  assert.ok(mapsCheck >= 0 && targetCheck >= 0 && mapsCheck < targetCheck, 'Google Maps dicek sebelum target');
  const expectedBootstrapHash = createHash('sha256').update(bootstrap).digest('base64');
  const escapedPolicy = document.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.ok(escapedPolicy);
  const policy = escapedPolicy.replaceAll('&#39;', "'");
  assert.ok(policy.includes(`script-src 'sha256-${expectedBootstrapHash}'`));
  assert.ok(policy.includes("connect-src 'none'"));
  assert.ok(policy.includes("form-action 'none'"));
  assert.ok(policy.includes("frame-src 'none'"));
  assert.ok(policy.includes("worker-src 'none'"));
  assert.ok(policy.includes("navigate-to 'none'"));
  assert.ok(!policy.includes('unsafe-eval'));
  assert.ok(bootstrap.includes("type: 'bagdja:template:navigate'"));
  assert.ok(bootstrap.includes("url.hostname === 'wa.me'"));
  assert.ok(bootstrap.includes('event.preventDefault()'));
  assert.ok(bootstrap.includes("type: 'bagdja:template:order-action'"));
  assert.ok(bootstrap.includes("message.type !== 'bagdja:template:order-action-result'"));
  assert.ok(bootstrap.includes("closest('[data-bagdja-refresh]')"));
  assert.ok(bootstrap.includes("type: 'bagdja:template:refresh', ...identity, requestId"));
  assert.ok(bootstrap.includes("message.type !== 'bagdja:template:refresh-result'"));
  // Pengaman navigasi: bootstrap menjawab ping host dengan requestId yang sama.
  assert.ok(bootstrap.includes("message.type !== 'bagdja:template:ping'"));
  assert.ok(bootstrap.includes("type: 'bagdja:template:pong', ...identity, requestId: message.requestId"));
  assert.ok(document.includes('https://tenant.example.test/_next/static/css/site.css'));
  assert.ok(!document.includes('attacker.example.test'));
  assert.ok(!document.includes('window.pwned'));
  assert.ok(!document.includes('http-equiv="refresh"'));
  assert.ok(!document.includes('<iframe src="https://evil.test"'));
  assert.ok(document.includes('<main>Rendered</main>'));
});

test('loads only an integrity-verified client bundle in the opaque frame with restricted network policy', async () => {
  const bundle = Buffer.from('document.body.dataset.hydrated = "yes";');
  const bundleBase64 = bundle.toString('base64');
  const bundleSha256 = createHash('sha256').update(bundle).digest('hex');
  const document = await createTemplateRuntimeSsrDocument({
    html: '<main onclick="steal()">Dynamic page</main><img src="https://tenant-project.supabase.co/storage/v1/object/public/product.jpg" onerror="steal()"><img src="https://cdn.example.test/storage/tenant/banner.jpg"><div src="https://attacker.example.test/pixel"></div>',
    identity,
    parentOrigin: 'https://tenant.example.test',
    tenantPathPrefix: '/store',
    stylesheetUrls: [],
    clientBundle: bundleBase64,
    clientBundleSha256: bundleSha256,
  });
  const bootstrap = document.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(bootstrap);
  assert.doesNotThrow(() => new Function(bootstrap));
  const policy = document.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1]?.replaceAll('&#39;', "'");
  assert.ok(policy?.includes(`script-src 'sha256-${createHash('sha256').update(bootstrap).digest('base64')}' blob:`));
  assert.ok(policy?.includes("connect-src 'none'"));
  assert.ok(policy?.includes("img-src data: blob: https://cdn.example.test https://tenant-project.supabase.co"));
  assert.ok(!policy?.includes('attacker.example.test'));
  assert.ok(bootstrap.includes('URL.createObjectURL(new Blob'));
  assert.ok(document.includes('https://tenant-project.supabase.co/storage/v1/object/public/product.jpg'));
  assert.ok(document.includes('https://cdn.example.test/storage/tenant/banner.jpg'));
  assert.ok(!document.includes('attacker.example.test'));
  assert.ok(!document.includes('onclick='));
  await assert.rejects(
    createTemplateRuntimeSsrDocument({
      html: '<main></main>',
      identity,
      parentOrigin: 'https://tenant.example.test',
      tenantPathPrefix: '/store',
      stylesheetUrls: [],
      clientBundle: bundleBase64,
      clientBundleSha256: 'b'.repeat(64),
    }),
    /integrity check failed/,
  );
});

test('excludes email and raw transaction sections, and drops pages that break the contract', () => {
  const base = {
    isPreview: false,
    profile: { name: 'Toko', email: 'owner@example.test' },
    auth: { isLoggedIn: true, email: 'buyer@example.test', username: 'Buyer' },
    sections: [
      { type: 'order_detail', content: { transaction: { id: 'private-transaction-id', phone: 'raw' } } },
      { type: 'text_block', content: { body: 'Public text' } },
    ],
    products: [],
    locations: [],
    faqs: [],
  };
  const invalid = sanitizeTemplateRuntimeProps({
    ...base,
    page: {
      type: 'order_detail',
      transaction: { title: 'Detail', createdAt: '2026-11-09', items: [] },
      actions: ['order.cancel', 'untrusted.action'],
    },
  });
  assert.equal(invalid.profile.email, undefined);
  assert.equal(invalid.auth.email, undefined);
  assert.deepEqual(invalid.sections.map((section) => section.type), ['text_block']);
  assert.equal(invalid.page, undefined, 'a page that breaks the contract must not reach the template');

  const page = {
    type: 'order_detail',
    contractVersion: 2,
    currency: 'IDR',
    timezone: 'Asia/Jakarta',
    transaction: {
      key: 'kOpaqueTransactionKey01',
      status: 'PENDING_PAYMENT',
      statusLabel: 'Menunggu pembayaran',
      createdAt: '2026-11-09T02:00:00.000Z',
      paymentMode: 'ESCROW',
      paymentModeLabel: 'Sudah checkout',
      subtotalAmount: 100000,
      shippingAmount: 0,
      totalAmount: 100000,
      title: 'Detail',
      subtotalLabel: 'Rp 100.000',
      shippingLabel: 'Rp 0',
      totalLabel: 'Rp 100.000',
      items: [{ key: 'kOpaqueItemKey0001', name: 'Product', quantity: 1, unitPrice: 100000, totalAmount: 100000, unitPriceLabel: 'Rp 100.000', totalLabel: 'Rp 100.000' }],
      shipping: null,
    },
    actions: ['order.cancel'],
  };
  const valid = sanitizeTemplateRuntimeProps({ ...base, page });
  assert.deepEqual(valid.page, page);
  assert.notEqual(valid.page, page, 'the page is copied, not shared');

  const withEmail = sanitizeTemplateRuntimeProps({
    ...base,
    page: { ...page, transaction: { ...page.transaction, buyerEmail: 'buyer@example.test' } },
  });
  assert.equal(withEmail.page, undefined);
});

test('validates iframe order-action intents against identity, source, and host allowlist', async () => {
  const requestId = '123e4567-e89b-42d3-a456-426614174000';
  const message = {
    protocol: 1,
    type: 'bagdja:template:order-action',
    ...identity,
    requestId,
    action: 'order.cancel',
  };
  assert.equal(parseTemplateRuntimeOrderActionMessage(message)?.action, 'order.cancel');
  assert.equal(parseTemplateRuntimeOrderActionMessage({ ...message, action: 'transaction.delete' }), null);
  assert.equal(parseTemplateRuntimeOrderActionMessage({ ...message, digest: 'b'.repeat(64) })?.digest, 'b'.repeat(64));
  assert.equal(parseTemplateRuntimeOrderActionMessage({ ...message, requestId: 'invalid' }), null);

  const responses = [];
  const frame = { postMessage: (data, targetOrigin) => responses.push({ data, targetOrigin }) };
  let actionCount = 0;
  const handler = createTemplateRuntimeOrderActionBridge({
    frame,
    identity,
    allowedActions: ['order.cancel'],
    onAction: async () => { actionCount += 1; },
  });
  await handler({ source: {}, origin: 'null', data: message });
  await handler({ source: frame, origin: 'https://tenant.example.test', data: message });
  await handler({ source: frame, origin: 'null', data: { ...message, digest: 'b'.repeat(64) } });
  await handler({ source: frame, origin: 'null', data: { ...message, action: 'order.complete' } });
  await handler({ source: frame, origin: 'null', data: message });
  await handler({ source: frame, origin: 'null', data: message });

  assert.equal(actionCount, 1);
  assert.equal(responses.length, 1);
  assert.equal(responses[0].targetOrigin, '*');
  assert.equal(responses[0].data.result.ok, true);
});

test('reports bounded header height through the identity-bound resize bridge', async () => {
  const document = await createTemplateRuntimeSsrDocument({
    html: '<header>Header</header>',
    identity,
    parentOrigin: 'https://tenant.example.test',
    tenantPathPrefix: '/store',
    stylesheetUrls: [],
    resizeToContent: true,
  });
  const bootstrap = document.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(bootstrap);
  assert.match(bootstrap, /new ResizeObserver/);
  assert.match(bootstrap, /new MutationObserver/);
  assert.match(bootstrap, /document\.body\.scrollHeight/);
  // Chrome Android (TWA) men-throttle iframe tak terlihat: tinggi juga dilaporkan segera & lewat timer.
  assert.match(bootstrap, /reportHeight\(\);\n\s*requestAnimationFrame\(reportHeight\)/);
  assert.match(bootstrap, /setTimeout\(reportHeight, delay\)/);
  assert.doesNotThrow(() => new Function(bootstrap));

  const message = {
    protocol: 1,
    type: 'bagdja:template:resize',
    ...identity,
    height: 118,
  };
  assert.equal(isTemplateRuntimeResizeMessage(message, identity), true);
  assert.equal(isTemplateRuntimeResizeMessage({ ...message, height: 601 }, identity), false);
  assert.equal(isTemplateRuntimeResizeMessage({ ...message, digest: 'b'.repeat(64) }, identity), false);
});

test('reports the Kumpul notification anchor through an identity-bound iframe message', async () => {
  const kumpulIdentity = { ...identity, slug: 'kumpul' };
  const document = await createTemplateRuntimeSsrDocument({
    html: '<span class="kumpul-brand-copy">Kumpul</span>',
    identity: kumpulIdentity,
    parentOrigin: 'https://tenant.example.test',
    tenantPathPrefix: '/store',
    stylesheetUrls: [],
  });
  const bootstrap = document.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(bootstrap);
  assert.match(bootstrap, /bagdja:template:notification-anchor/);
  assert.match(bootstrap, /\.kumpul-brand-copy/);

  const message = {
    protocol: 1,
    type: 'bagdja:template:notification-anchor',
    ...kumpulIdentity,
    x: 280,
    y: 36,
  };
  assert.equal(isTemplateRuntimeNotificationAnchorMessage(message, kumpulIdentity), true);
  assert.equal(isTemplateRuntimeNotificationAnchorMessage({ ...message, x: -1 }, kumpulIdentity), false);
  assert.equal(isTemplateRuntimeNotificationAnchorMessage({ ...message, y: Infinity }, kumpulIdentity), false);
  assert.equal(isTemplateRuntimeNotificationAnchorMessage({ ...message, version: '1.2.4' }, kumpulIdentity), false);
});

test('allows only phone-number WhatsApp links outside the tenant origin', () => {
  const allowed = getAllowedTemplateNavigationUrl(
    'https://wa.me/6285188448383',
    'http://localhost:5005',
    '/fashion-store',
  );
  assert.equal(allowed?.href, 'https://wa.me/6285188448383');
  assert.equal(
    getAllowedTemplateNavigationUrl('https://wa.me.evil.test/6285188448383', 'http://localhost:5005', '/fashion-store'),
    null,
  );
  assert.equal(
    getAllowedTemplateNavigationUrl('https://wa.me/6285188448383?text=hello', 'http://localhost:5005', '/fashion-store'),
    null,
  );
  assert.equal(
    getAllowedTemplateNavigationUrl('https://example.com/', 'http://localhost:5005', '/fashion-store'),
    null,
  );
});

test('allows platform auth links only when their return path stays in the tenant', () => {
  assert.equal(
    getAllowedTemplateNavigationUrl(
      'http://localhost:5005/auth/login?next=%2Ffashion-store%2Fcart',
      'http://localhost:5005',
      '/fashion-store',
    )?.pathname,
    '/auth/login',
  );
  assert.equal(
    getAllowedTemplateNavigationUrl(
      'http://localhost:5005/auth/logout?returnTo=%2Ffashion-store%2F',
      'http://localhost:5005',
      '/fashion-store',
    )?.pathname,
    '/auth/logout',
  );
  assert.equal(
    getAllowedTemplateNavigationUrl(
      'http://localhost:5005/auth/login?next=https%3A%2F%2Fevil.test',
      'http://localhost:5005',
      '/fashion-store',
    ),
    null,
  );
  assert.equal(
    getAllowedTemplateNavigationUrl(
      'http://localhost:5005/auth/logout?returnTo=%2Fother-tenant',
      'http://localhost:5005',
      '/fashion-store',
    ),
    null,
  );
});

test('rejects invalid tenant origins and path prefixes', async () => {
  const base = {
    html: '<main>Rendered</main>',
    identity,
    parentOrigin: 'https://tenant.example.test',
    tenantPathPrefix: '/store',
    stylesheetUrls: [],
  };
  await assert.rejects(
    createTemplateRuntimeSsrDocument({ ...base, parentOrigin: 'https://tenant.example.test/path' }),
    /HTTP\(S\) origin/,
  );
  await assert.rejects(
    createTemplateRuntimeSsrDocument({ ...base, tenantPathPrefix: '//attacker.example.test' }),
    /path prefix is invalid/,
  );
});

test('validates system-page intents from the template iframe', async () => {
  const requestId = '123e4567-e89b-42d3-a456-426614174001';
  const base = { protocol: 1, type: 'bagdja:template:intent', ...identity, requestId };
  const key = 'kOpaqueCartKey0001';
  assert.deepEqual(
    parseTemplateRuntimeIntentMessage({ ...base, intent: { action: 'cart.set_quantity', key, quantity: 3 } })?.intent,
    { action: 'cart.set_quantity', key, quantity: 3 },
  );
  assert.equal(parseTemplateRuntimeIntentMessage({ ...base, intent: { action: 'cart.set_quantity', key, quantity: 0 } }), null);
  assert.equal(parseTemplateRuntimeIntentMessage({ ...base, intent: { action: 'cart.set_quantity', key, quantity: 1000 } }), null);
  assert.equal(parseTemplateRuntimeIntentMessage({ ...base, intent: { action: 'cart.remove', key: '../1' } }), null);
  assert.equal(parseTemplateRuntimeIntentMessage({ ...base, intent: { action: 'cart.checkout', keys: [] } }), null);

  // Banner undangan dari iframe datang sebagai bytes; host membuat File miliknya sendiri.
  const bannerIntent = (banner) => parseTemplateRuntimeIntentMessage({
    ...base,
    intent: { action: 'gathering.invitation.content.save', key, invitationContent: { description: 'Hai' }, ...banner },
  })?.intent ?? null;
  const fromBytes = bannerIntent({ banner: { bytes: new Uint8Array([1, 2, 3]).buffer, type: 'image/png', name: '../x<y>.png' } });
  assert.ok(fromBytes?.bannerFile instanceof File);
  assert.equal(fromBytes.bannerFile.size, 3);
  assert.equal(fromBytes.bannerFile.type, 'image/png');
  assert.equal(fromBytes.bannerFile.name, '.._x_y_.png');
  assert.equal(bannerIntent({ banner: { bytes: new ArrayBuffer(3), type: 'text/html', name: 'a.html' } }), null, 'banner harus gambar');
  assert.equal(bannerIntent({ banner: { bytes: 'AAAA', type: 'image/png', name: 'a.png' } }), null, 'bytes wajib ArrayBuffer');
  assert.equal(bannerIntent({ banner: { bytes: new ArrayBuffer(5 * 1024 * 1024 + 1), type: 'image/png', name: 'a.png' } }), null, 'banner maks. 5 MB');
  assert.equal(
    bannerIntent({ bannerFile: new Blob(['x'], { type: 'image/png' }) })?.bannerFile,
    undefined,
    'File mentah dari pesan iframe dibuang',
  );
  assert.deepEqual(
    parseTemplateRuntimeIntentMessage({ ...base, intent: { action: 'cart.checkout', keys: [key, key] } })?.intent,
    { action: 'cart.checkout', keys: [key] },
  );
  assert.equal(parseTemplateRuntimeIntentMessage({ ...base, intent: { action: 'wallet.withdraw', key } }), null);
  assert.equal(parseTemplateRuntimeIntentMessage({ ...base, digest: 'short', intent: { action: 'cart.remove', key } }), null);

  const posted = [];
  const frame = { postMessage: (data) => posted.push(data) };
  const handled = [];
  const bridge = createTemplateRuntimeIntentBridge({
    frame,
    identity,
    allowedActions: ['cart.remove'],
    onIntent: async (intent) => { handled.push(intent.action); },
  });
  await bridge({ source: frame, origin: 'null', data: { ...base, intent: { action: 'cart.remove', key } } });
  await bridge({ source: frame, origin: 'null', data: { ...base, intent: { action: 'cart.remove', key } } });
  await bridge({ source: frame, origin: 'null', data: { ...base, requestId: '123e4567-e89b-42d3-a456-426614174002', intent: { action: 'invoice.pay', key } } });
  await bridge({ source: {}, origin: 'null', data: { ...base, requestId: '123e4567-e89b-42d3-a456-426614174003', intent: { action: 'cart.remove', key } } });
  assert.deepEqual(handled, ['cart.remove'], 'replays, disallowed actions, and foreign sources are ignored');
  assert.equal(posted.length, 1);
  assert.equal(posted[0].type, 'bagdja:template:intent-result');
  assert.deepEqual(posted[0].result, { ok: true });
});

test('validates gathering plan management intents and keeps bootstrap in sync', () => {
  assert.deepEqual([...BOOTSTRAP_INTENTS].sort(), [...TEMPLATE_RUNTIME_INTENTS].sort());
  for (const action of ['gathering.cancel', 'gathering.registration.refund', 'gathering.event.confirm', 'cart.remove']) {
    assert.equal(typeof TEMPLATE_RUNTIME_INTENT_CONFIRMATIONS[action], 'string', `${action} dikonfirmasi host`);
  }
  const requestId = '123e4567-e89b-42d3-a456-426614174009';
  const base = { protocol: 1, type: 'bagdja:template:intent', ...identity, requestId };
  const key = 'kPlanKey000000001';
  const other = 'kItemKey000000001';
  const parse = (intent) => parseTemplateRuntimeIntentMessage({ ...base, intent })?.intent ?? null;

  assert.deepEqual(parse({
    action: 'gathering.plan.save', key, submit: true,
    plan: { title: ' Workshop ', invitePolicy: 'OPEN', optionKeys: [other, other], rsvpCloseAt: '2026-12-10T23:59', scheduledAt: '2026-12-20T09:00:00+07:00', extra: 'x' },
  }), {
    action: 'gathering.plan.save', key, submit: true,
    plan: { optionKeys: [other], title: 'Workshop', invitePolicy: 'OPEN', rsvpCloseAt: '2026-12-10T23:59', scheduledAt: '2026-12-20T09:00:00+07:00' },
  });
  assert.deepEqual(parse({ action: 'gathering.chat.open', key }), { action: 'gathering.chat.open', key });
  assert.equal(parse({ action: 'gathering.plan.save', key, plan: { rsvpCloseAt: '10/12/2026' } }), null);
  assert.equal(parse({ action: 'gathering.plan.save', key, plan: { invitePolicy: 'PRIVATE' } }), null);
  assert.equal(parse({ action: 'gathering.plan.save', key, plan: { title: 'x'.repeat(256) } }), null);
  assert.deepEqual(parse({ action: 'gathering.event.confirm', key, plan: { optionKeys: [other], title: 'ignored' } }), {
    action: 'gathering.event.confirm', key, plan: { optionKeys: [other] },
  });
  assert.equal(parse({ action: 'gathering.event.confirm', key, plan: {} }), null);

  assert.deepEqual(parse({ action: 'gathering.invitation.add', key, invitee: { name: 'Dewi', whatsapp: '+62 811-2345' } }), {
    action: 'gathering.invitation.add', key, invitee: { name: 'Dewi', whatsapp: '+62 811-2345' },
  });
  assert.equal(parse({ action: 'gathering.invitation.add', key, invitee: { name: 'Dewi' } }), null);
  assert.equal(parse({ action: 'gathering.invitation.add', key, invitee: { email: 'bukan-email' } }), null);

  const withBanner = parse({
    action: 'gathering.invitation.content.save', key, invitationContent: { description: ' Hai ' },
    banner: { bytes: new Uint8Array([120]).buffer, type: 'image/jpeg', name: 'banner.jpg' },
  });
  assert.deepEqual(withBanner?.invitationContent, { description: 'Hai' });
  assert.equal(withBanner?.bannerFile?.type, 'image/jpeg');
  assert.equal(withBanner?.bannerFile?.name, 'banner.jpg');
  assert.deepEqual(
    parse({ action: 'gathering.invitation.content.save', key, invitationContent: { description: '', removeBanner: true } }),
    { action: 'gathering.invitation.content.save', key, invitationContent: { description: '', removeBanner: true } },
  );
  assert.equal(parse({ action: 'gathering.invitation.content.save', key }), null);
  // RSVP undangan: data peserta tervalidasi, opsi berupa key opaque; OTP 6 digit.
  assert.deepEqual(
    parse({ action: 'gathering.invitation.rsvp', key, rsvp: { attendeeName: ' Dewi ', contact: 'dewi@example.com', optionKeys: [other, other] } }),
    { action: 'gathering.invitation.rsvp', key, rsvp: { attendeeName: 'Dewi', contact: 'dewi@example.com', optionKeys: [other] } },
  );
  assert.equal(parse({ action: 'gathering.invitation.rsvp', key, rsvp: { contact: 'bukan-email' } }), null);
  assert.equal(parse({ action: 'gathering.invitation.rsvp', key, rsvp: { optionKeys: ['../x'] } }), null);
  assert.deepEqual(parse({ action: 'gathering.invitation.verify_otp', key, code: '123456' }), { action: 'gathering.invitation.verify_otp', key, code: '123456' });
  assert.equal(parse({ action: 'gathering.invitation.verify_otp', key, code: '12a456' }), null);
  assert.deepEqual(parse({ action: 'gathering.invitation.pay', key }), { action: 'gathering.invitation.pay', key });
  // Kirim undangan: isi tampilan opsional; file banner hanya bersama isi tampilan.
  assert.deepEqual(parse({ action: 'gathering.invitations.submit', key }), { action: 'gathering.invitations.submit', key });
  assert.deepEqual(
    parse({ action: 'gathering.invitations.submit', key, invitationContent: { description: ' Hai ' } }),
    { action: 'gathering.invitations.submit', key, invitationContent: { description: 'Hai' } },
  );
  assert.equal(parse({ action: 'gathering.invitations.submit', key, invitationContent: { description: 'x'.repeat(5001) } }), null);
  assert.equal(parse({ action: 'gathering.invitation.content.save', key, invitationContent: { description: 'x'.repeat(5001) } }), null);
  assert.equal(parse({
    action: 'gathering.invitation.content.save', key, invitationContent: { description: '' },
    banner: { bytes: new TextEncoder().encode('<p>').buffer, type: 'text/html', name: 'a.html' },
  }), null, 'banner harus gambar');
  assert.equal(parse({
    action: 'gathering.invitation.content.save', key, invitationContent: { description: '' },
    banner: { bytes: new ArrayBuffer(5 * 1024 * 1024 + 1), type: 'image/png', name: 'a.png' },
  }), null, 'banner maks. 5 MB');
  assert.equal(parse({
    action: 'gathering.invitation.content.save', key, invitationContent: { description: '' }, banner: 'data:image/png;base64,AAAA',
  }), null);

  assert.deepEqual(parse({ action: 'gathering.registration.refund', key, target: other }), { action: 'gathering.registration.refund', key, target: other });
  assert.equal(parse({ action: 'gathering.registration.refund', key, target: '../reg' }), null);
  assert.deepEqual(parse({ action: 'gathering.registrations.reject', key, keys: [other], message: ' Kuota penuh ' }), {
    action: 'gathering.registrations.reject', key, keys: [other], message: 'Kuota penuh',
  });
  assert.equal(parse({ action: 'gathering.registrations.reject', key, keys: [other] }), null, 'alasan wajib');
  assert.deepEqual(parse({ action: 'gathering.registrations.checkout', key, keys: [other] }), {
    action: 'gathering.registrations.checkout', key, keys: [other],
  });
  assert.deepEqual(parse({ action: 'gathering.cancel', key }), { action: 'gathering.cancel', key });
  assert.deepEqual(parse({ action: 'gathering.cancel', key, confirmed: true }), { action: 'gathering.cancel', key, confirmed: true });
  assert.deepEqual(parse({ action: 'gathering.cancel', key, confirmed: 'yes' }), { action: 'gathering.cancel', key });
  assert.deepEqual(parse({ action: 'gathering.plan.save', key, plan: {}, confirmed: true }), { action: 'gathering.plan.save', key, plan: {} }, 'confirmed hanya untuk aksi yang dikonfirmasi host');
  assert.equal(parse({ action: 'gathering.cancel', key, reason: 'x'.repeat(501) }), null);
});

test('lets templates open Google Maps venue links only, with the bootstrap and host using one pattern', () => {
  assert.equal(GOOGLE_MAPS_PATTERN_SOURCE, GOOGLE_MAPS_NAVIGATION_URL.source);
  const origin = 'https://toko.test';
  assert.equal(getAllowedTemplateNavigationUrl('https://maps.app.goo.gl/AbC123', origin, '/')?.hostname, 'maps.app.goo.gl');
  assert.equal(getAllowedTemplateNavigationUrl('https://www.google.com/maps/place/Kemang', origin, '/')?.pathname, '/maps/place/Kemang');
  assert.equal(getAllowedTemplateNavigationUrl('https://maps.app.goo.gl.evil.test/x', origin, '/'), null);
  assert.equal(getAllowedTemplateNavigationUrl('https://evil.test/maps', origin, '/'), null);
});

test('templates can ask the host to share or copy same-origin tenant links only', () => {
  const origin = 'https://toko.test';
  assert.equal(getAllowedTemplateShareUrl('https://toko.test/gathering/invite/abc', origin, '/')?.pathname, '/gathering/invite/abc');
  assert.equal(getAllowedTemplateShareUrl('https://maps.app.goo.gl/AbC123', origin, '/'), null, 'bukan Google Maps');
  assert.equal(getAllowedTemplateShareUrl('https://wa.me/628123456789', origin, '/'), null, 'bukan WhatsApp');
  assert.equal(getAllowedTemplateShareUrl('https://evil.test/x', origin, '/'), null);
  assert.equal(getAllowedTemplateShareUrl('javascript:alert(1)', origin, '/'), null);

  const requestId = '123e4567-e89b-42d3-a456-426614174099';
  const base = { protocol: 1, type: 'bagdja:template:share', ...identity, requestId, href: 'https://toko.test/gathering/invite/abc' };
  assert.deepEqual(parseTemplateRuntimeShareMessage({ ...base, mode: 'copy', title: '  Undangan  ' }, identity), { ...base, mode: 'copy', title: 'Undangan' });
  assert.equal(parseTemplateRuntimeShareMessage({ ...base, mode: 'print' }, identity), null);
  assert.equal(parseTemplateRuntimeShareMessage({ ...base, mode: 'share', digest: 'b'.repeat(64) }, identity), null, 'identitas harus cocok');
  assert.equal(parseTemplateRuntimeShareMessage({ ...base, mode: 'share', requestId: 'x' }, identity), null);
});

test('templates can ask the host to reload page data (soft refresh) with a valid identity only', () => {
  const requestId = '123e4567-e89b-42d3-a456-426614174077';
  const base = { protocol: 1, type: 'bagdja:template:refresh', ...identity, requestId };
  assert.deepEqual(parseTemplateRuntimeRefreshMessage({ ...base, extra: 'x' }, identity), base);
  assert.equal(parseTemplateRuntimeRefreshMessage({ ...base, digest: 'b'.repeat(64) }, identity), null, 'identitas harus cocok');
  assert.equal(parseTemplateRuntimeRefreshMessage({ ...base, requestId: 'x' }, identity), null);
  assert.equal(parseTemplateRuntimeRefreshMessage({ ...base, type: 'bagdja:template:share' }, identity), null);
});

test('accepts only identity-bound pong replies for the navigation guard', () => {
  const pong = { protocol: 1, type: 'bagdja:template:pong', ...identity, requestId: '123e4567-e89b-42d3-a456-426614174000' };
  assert.equal(isTemplateRuntimePongMessage(pong, identity), true);
  assert.equal(isTemplateRuntimePongMessage({ ...pong, digest: 'b'.repeat(64) }, identity), false);
  assert.equal(isTemplateRuntimePongMessage({ ...pong, type: 'bagdja:template:ping' }, identity), false);
  assert.equal(isTemplateRuntimePongMessage({ ...pong, requestId: 'x'.repeat(65) }, identity), false);
});


// ── Mode client (template-client-rendering-plan §5) ───────────────────────────

const BROWSER_BUNDLE = Buffer.from(
  'globalThis.BagdjaTemplate = Object.freeze({\n' +
  `  render: (props) => ${JSON.stringify('<main class="kumpul-brand-copy" onclick="steal()">Halo ')} + props.profile.name + "</main>",\n` +
  `  clientSource: ${JSON.stringify('document.body.dataset.enhanced = "yes";')},\n` +
  '});',
);
const BROWSER_SHA = createHash('sha256').update(BROWSER_BUNDLE).digest('hex');

async function clientDocument(overrides = {}) {
  return createTemplateRuntimeSsrDocument({
    html: '',
    // slug kumpul: bootstrap memasang anchor notifikasi yang menunggu template siap.
    identity: { ...identity, slug: 'kumpul', digest: BROWSER_SHA },
    parentOrigin: 'https://tenant.example.test',
    tenantPathPrefix: '/store',
    stylesheetUrls: [],
    clientRender: {
      props: { profile: { name: 'Toko </script><script>alert(1)</script>' } },
      bundleBase64: BROWSER_BUNDLE.toString('base64'),
      bundleSha256: BROWSER_SHA,
    },
    ...overrides,
  });
}

test('client mode: props as inert JSON, bundle hash verified, blob scripts and https images only', async () => {
  const document = await clientDocument();
  const bootstrap = document.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(bootstrap);
  assert.doesNotThrow(() => new Function(bootstrap));
  const policy = document.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1]?.replaceAll('&#39;', "'");
  assert.ok(policy?.includes(`script-src 'sha256-${createHash('sha256').update(bootstrap).digest('base64')}' blob:`));
  assert.ok(policy?.includes("connect-src 'none'"));
  assert.ok(policy?.includes('img-src data: blob: https:'));
  const propsJson = document.match(/<script type="application\/json" id="bagdja-template-props">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(propsJson, 'props are embedded as non-executable JSON');
  assert.ok(!propsJson.includes('</script>'), 'props cannot close the JSON script element');
  assert.deepEqual(JSON.parse(propsJson), { profile: { name: 'Toko </script><script>alert(1)</script>' } });

  await assert.rejects(
    clientDocument({ clientRender: { props: {}, bundleBase64: BROWSER_BUNDLE.toString('base64'), bundleSha256: 'b'.repeat(64) } }),
    /integrity check failed/,
  );
  await assert.rejects(clientDocument({ html: '<main></main>' }), /browser bundle is invalid/);
});

test('client mode bootstrap renders the template, sanitizes it, then runs clientSource and fires template-ready', async () => {
  const document = await clientDocument();
  const bootstrap = document.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  const propsJson = document.match(/id="bagdja-template-props">([\s\S]*?)<\/script>/)?.[1];

  const listeners = new Map();
  const events = [];
  const blobs = new Map();
  const sandbox = {};
  const fakeDocument = {
    body: {
      innerHTML: '',
      dataset: {},
      appendChild(script) {
        // Blob script: jalankan isinya di "jendela" iframe tiruan, lalu onload.
        const source = blobs.get(script.src);
        new Function('globalThis', 'document', source)(sandbox, fakeDocument);
        script.onload?.();
      },
    },
    getElementById: (id) => (id === 'bagdja-template-props'
      ? { textContent: propsJson, remove() {} }
      : null),
    createElement: () => ({}),
    querySelector: (selector) => (selector === '.kumpul-brand-copy' && fakeDocument.body.innerHTML.includes('kumpul-brand-copy')
      ? { getBoundingClientRect: () => ({ right: 10, top: 4, height: 20 }) }
      : null),
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    },
    dispatchEvent(event) {
      events.push(event.type);
      for (const callback of listeners.get(event.type) ?? []) callback(event);
    },
  };
  const posted = [];
  const run = new Function(
    'window', 'document', 'parent', 'globalThis', 'URL', 'Blob', 'CustomEvent', 'atob', 'DOMParser', 'ResizeObserver',
    bootstrap,
  );
  run(
    { addEventListener() {}, scrollX: 0, scrollY: 0 },
    fakeDocument,
    { postMessage: (message) => posted.push(message) },
    sandbox,
    { createObjectURL: (blob) => { const key = `blob:${blobs.size}`; blobs.set(key, blob.source); return key; }, revokeObjectURL() {} },
    class { constructor([part]) { this.source = typeof part === 'string' ? part : Buffer.from(part).toString('utf8'); } },
    class { constructor(type) { this.type = type; } },
    atob,
    globalThis.DOMParser,
    undefined,
  );
  for (const callback of listeners.get('DOMContentLoaded') ?? []) callback();

  assert.equal(fakeDocument.body.innerHTML.includes('onclick'), false, 'template HTML is sanitized like SSR');
  assert.match(fakeDocument.body.innerHTML, /Halo Toko/);
  assert.equal(fakeDocument.body.dataset.enhanced, 'yes', 'clientSource runs after the HTML is in place');
  assert.deepEqual(events, ['bagdja:template:rendered']);
  assert.ok(
    posted.some((message) => message.type === 'bagdja:template:notification-anchor'),
    'listeners waiting for the template (Kumpul notification anchor) run after the client render',
  );
});

test('client mode is chosen only with the flag, a valid bundle, https in production, and browser JS allowed', () => {
  const bundle = { url: 'https://cdn.example.test/org/app/kumpul-browser.js', sha256: BROWSER_SHA };
  const on = { TEMPLATE_CLIENT_RENDER_ENABLED: 'true', NODE_ENV: 'production' };
  assert.deepEqual(getTemplateClientRenderBundle('kumpul', '1.3.42', bundle, on), bundle);
  assert.equal(getTemplateClientRenderBundle('kumpul', '1.3.42', bundle, { NODE_ENV: 'production' }), null);
  assert.equal(getTemplateClientRenderBundle('kumpul', '1.3.42', undefined, on), null);
  assert.equal(getTemplateClientRenderBundle('kumpul', '1.3.42', { ...bundle, sha256: 'xyz' }, on), null);
  assert.equal(getTemplateClientRenderBundle('kumpul', '1.3.42', { ...bundle, url: 'http://cdn.example.test/a.js' }, on), null);
  assert.deepEqual(
    getTemplateClientRenderBundle('kumpul', '1.3.42', { ...bundle, url: 'http://localhost:4008/a.js' }, { TEMPLATE_CLIENT_RENDER_ENABLED: 'true' }),
    { ...bundle, url: 'http://localhost:4008/a.js' },
  );
  assert.equal(
    getTemplateClientRenderBundle('kumpul', '1.3.42', bundle, { ...on, TEMPLATE_RUNTIME_CLIENT_BUNDLE_ENABLED: 'false' }),
    null,
  );
});


// ── D7: render langsung tanpa iframe ──────────────────────────────────────────

const inlineRuntimeModule = { exports: {} };
new Function('exports', 'module', 'require', ts.transpileModule(
  await readFile(join(projectRoot, 'lib/template-inline-runtime.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText)(inlineRuntimeModule.exports, inlineRuntimeModule, (specifier) =>
  specifier.endsWith('template-browser-bundle') ? browserBundleModule.exports : require(specifier));
const { startInlineBootstrap, isTemplateInlineRenderEnabled } = {
  ...inlineRuntimeModule.exports,
  isTemplateInlineRenderEnabled: runtimeClientModule.exports.isTemplateInlineRenderEnabled,
};

test('inline bootstrap waits for the host render event and trusts the template confirm popup', () => {
  const bootstrap = createTemplateInlineBootstrap({
    identity, parentOrigin: 'https://tenant.example.test', tenantPathPrefix: '/store',
  });
  assert.doesNotThrow(() => new Function('document', bootstrap));
  assert.match(bootstrap, /'bagdja:template:rendered'/);
  assert.doesNotMatch(bootstrap, /'DOMContentLoaded'/);
  assert.match(bootstrap, /event\.isTrusted \|\| true/);
  assert.doesNotMatch(bootstrap, /ResizeObserver\(reportHeight\)/, 'no frame height reporting without an iframe');
});

test('inline bootstrap listens and searches only inside its own template root', () => {
  const calls = [];
  const root = {
    addEventListener: (type) => calls.push(`root.listen:${type}`),
    removeEventListener() {},
    dispatchEvent: () => calls.push('root.dispatch'),
    querySelector: (selector) => { calls.push(`root.query:${selector}`); return null; },
    querySelectorAll: () => [],
  };
  globalThis.document = {
    addEventListener: (type) => calls.push(`document.listen:${type}`),
    createElement: (tag) => { calls.push(`document.create:${tag}`); return {}; },
    title: 'Toko',
  };
  try {
    startInlineBootstrap(root, `
      document.addEventListener('click', () => {});
      document.querySelector('.kumpul-brand-copy');
      document.createElement('div');
      document.dispatchEvent({ type: 'x' });
      if (document.title !== 'Toko') throw new Error('other properties come from the real document');
    `);
  } finally {
    delete globalThis.document;
  }
  assert.deepEqual(calls, [
    'root.listen:click',
    'root.query:.kumpul-brand-copy',
    'document.create:div',
    'root.dispatch',
  ]);
});

test('inline bridges accept messages from the tenant window itself, never from other origins', async () => {
  const posted = [];
  const page = { postMessage: (message) => posted.push(message) };
  const handled = [];
  const bridge = createTemplateRuntimeIntentBridge({
    frame: page,
    messageOrigin: 'https://tenant.example.test',
    identity,
    allowedActions: ['cart.remove'],
    onIntent: async (intent) => { handled.push(intent.action); },
  });
  const message = (requestId) => ({
    protocol: 1, type: 'bagdja:template:intent', ...identity, requestId, intent: { action: 'cart.remove', key: 'kCartKey000000001' },
  });
  await bridge({ source: page, origin: 'null', data: message('123e4567-e89b-42d3-a456-426614174101') });
  await bridge({ source: page, origin: 'https://evil.example.test', data: message('123e4567-e89b-42d3-a456-426614174102') });
  await bridge({ source: page, origin: 'https://tenant.example.test', data: message('123e4567-e89b-42d3-a456-426614174103') });
  assert.deepEqual(handled, ['cart.remove']);
  assert.equal(posted.length, 1);
});

test('inline render is opt-in through TEMPLATE_INLINE_RENDER_ENABLED', () => {
  assert.equal(isTemplateInlineRenderEnabled({}), false);
  assert.equal(isTemplateInlineRenderEnabled({ TEMPLATE_INLINE_RENDER_ENABLED: 'true' }), true);
});
