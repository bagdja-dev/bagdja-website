import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as ts from 'typescript';

const source = await readFile(new URL('../lib/template-runtime-client.ts', import.meta.url), 'utf8');

for (const required of [
  'TEMPLATE_RUNTIME_URL',
  'TEMPLATE_RUNTIME_TOKEN',
  'TEMPLATE_RUNTIME_TIMEOUT_MS',
  'TEMPLATE_RUNTIME_ENABLED',
  'TEMPLATE_RUNTIME_VERSION_MAP',
  'TEMPLATE_RUNTIME_CLIENT_BUNDLE_ENABLED',
  '/v1/render',
  'authorization: `Bearer ${config.token}`',
]) {
  assert(source.includes(required), `Runtime adapter missing contract marker: ${required}`);
}

assert(source.includes('if (tenantVersion == null) return null'), 'Unpinned websites must remain on the built-in renderer.');
assert(source.includes("env.TEMPLATE_RUNTIME_ENABLED !== 'true'"), 'A pinned website must fail closed when runtime is disabled.');
assert(source.includes('deploymentPin !== undefined && deploymentPin !== tenantVersion'), 'Optional deployment pins must match the exact tenant version.');
assert(source.includes("parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:'"), 'Runtime URL must be HTTP(S) only.');
assert(source.includes('cache: \'no-store\''), 'Runtime renders must not be cached on the Next.js adapter.');
assert(source.includes('result.digest'), 'Runtime response must verify an immutable artifact digest.');
assert(source.includes('clientBundleSha256 !== clientBundleDigest'), 'Browser bundle bytes must match the runtime-reported SHA-256.');

const contractModule = ts.transpileModule(
  await readFile(new URL('../lib/template-page-contract.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } },
).outputText;
const contractUrl = `data:text/javascript;base64,${Buffer.from(contractModule).toString('base64')}`;
const runtimeModule = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText.replace("from './template-page-contract'", `from '${contractUrl}'`);
const runtimeClient = await import(`data:text/javascript;base64,${Buffer.from(runtimeModule).toString('base64')}`);
const approvedEnv = {
  TEMPLATE_RUNTIME_ENABLED: 'true',
  TEMPLATE_RUNTIME_VERSION_MAP: JSON.stringify({ 'store-classic': '1.0.0' }),
};
assert.equal(runtimeClient.getTemplateRuntimeVersion('store-classic', null, approvedEnv), null);
assert.equal(runtimeClient.getTemplateRuntimeVersion('store-classic', '1.0.0', approvedEnv), '1.0.0');
assert.equal(runtimeClient.isTemplateRuntimeClientBundleApproved('store-classic', '1.0.0', approvedEnv), true);
const approvedClientBundleEnv = {
  ...approvedEnv,
  TEMPLATE_RUNTIME_CLIENT_BUNDLE_ENABLED: 'true',
};
assert.equal(runtimeClient.isTemplateRuntimeClientBundleApproved('store-classic', '1.0.0', approvedClientBundleEnv), true);
assert.equal(runtimeClient.isTemplateRuntimeClientBundleApproved('store-classic', '1.0.1', approvedClientBundleEnv), true);
assert.equal(runtimeClient.isTemplateRuntimeClientBundleApproved('store-classic', '1.0.0', {
  ...approvedClientBundleEnv,
  TEMPLATE_RUNTIME_CLIENT_BUNDLE_ENABLED: 'false',
}), false);
assert.throws(
  () => runtimeClient.getTemplateRuntimeVersion('store-classic', '1.0.0', { ...approvedEnv, TEMPLATE_RUNTIME_ENABLED: 'false' }),
  (error) => error.code === 'runtime_disabled',
);
assert.equal(runtimeClient.getTemplateRuntimeVersion('storefront-demo', '1.2.3', approvedEnv), '1.2.3');
assert.throws(
  () => runtimeClient.getTemplateRuntimeVersion('store-classic', '2.0.0', approvedEnv),
  (error) => error.code === 'runtime_version_not_approved',
);
const studioPreviewEnv = {
  ...approvedEnv,
  NODE_ENV: 'development',
  TEMPLATE_RUNTIME_STUDIO_PREVIEW_ENABLED: 'true',
};
assert.equal(
  runtimeClient.getTemplateRuntimeStudioPreviewVersion('store-classic', studioPreviewEnv),
  '1.0.0',
);
assert.equal(
  runtimeClient.getTemplateRuntimeStudioPreviewVersion('store-classic', {
    ...studioPreviewEnv,
    NODE_ENV: 'production',
  }),
  null,
);
assert.equal(
  runtimeClient.getTemplateRuntimeStudioPreviewVersion('store-classic', {
    ...studioPreviewEnv,
    TEMPLATE_RUNTIME_STUDIO_PREVIEW_ENABLED: 'false',
  }),
  null,
);
assert.equal(
  runtimeClient.getTemplateRuntimeStudioPreviewVersion('unapproved-template', studioPreviewEnv),
  null,
);
// Tanpa pin website, route tenant TIDAK memakai runtime eksternal walau slug tercantum di
// TEMPLATE_RUNTIME_VERSION_MAP — mencegah template bawaan bernama sama dibajak artefak lama.
assert.equal(
  runtimeClient.getTemplateRuntimeTenantVersion('store-classic', null, studioPreviewEnv),
  null,
);
assert.equal(
  runtimeClient.getTemplateRuntimeTenantVersion('store-classic', null, {
    ...studioPreviewEnv,
    NODE_ENV: 'production',
  }),
  null,
);
assert.equal(
  runtimeClient.getTemplateRuntimeTenantVersion('store-classic', '1.0.0', {
    ...studioPreviewEnv,
    NODE_ENV: 'production',
  }),
  '1.0.0',
);
assert.throws(
  () => runtimeClient.getTemplateRuntimeTenantVersion('store-classic', '2.0.0', studioPreviewEnv),
  (error) => error.code === 'runtime_version_not_approved',
);
const legacyRuntimeEnv = {
  ...studioPreviewEnv,
  TEMPLATE_RUNTIME_URL: 'http://127.0.0.1:5012',
  TEMPLATE_RUNTIME_TOKEN: 'test-token',
  TEMPLATE_RUNTIME_TIMEOUT_MS: '1000',
};
const legacyRuntimeRequest = {
  slug: 'store-classic',
  version: '1.0.0',
  props: { isPreview: true },
};
const legacyRuntimeResponse = {
  slug: 'store-classic',
  version: '1.0.0',
  digest: 'a'.repeat(64),
  html: '<main>SSR output</main>',
  clientEntryUrl: null,
};
const legacyRender = await runtimeClient.renderTemplateThroughRuntime(
  legacyRuntimeRequest,
  legacyRuntimeEnv,
  async () => new Response(JSON.stringify(legacyRuntimeResponse), { status: 200 }),
);
assert.equal(legacyRender.html, legacyRuntimeResponse.html);
assert.equal(legacyRender.clientBundle, null);
await assert.rejects(
  () => runtimeClient.renderTemplateThroughRuntime(
    legacyRuntimeRequest,
    legacyRuntimeEnv,
    async () => new Response(
      JSON.stringify({ ...legacyRuntimeResponse, clientEntryUrl: 'https://example.test/client.js' }),
      { status: 200 },
    ),
  ),
  (error) => error.code === 'template_client_bundle_not_supported',
);
const sanitizedProps = runtimeClient.sanitizeTemplateRuntimeProps({
  isPreview: false,
  auth: {
    isLoggedIn: true,
    username: 'Nandang',
    email: 'private@example.test',
    avatar: 'https://assets.supabase.co/avatar.png',
    loginHref: '/auth/login',
    logoutHref: '//attacker.example.test',
    cartHref: '/store/cart',
  },
});
assert.deepEqual(sanitizedProps.auth, {
  isLoggedIn: true,
  username: 'Nandang',
  avatar: 'https://assets.supabase.co/avatar.png',
  loginHref: '/auth/login',
  cartHref: '/store/cart',
});
assert(!JSON.stringify(sanitizedProps).includes('private@example.test'));
assert(!JSON.stringify(sanitizedProps).includes('//attacker.example.test'));
const emailFallbackProps = runtimeClient.sanitizeTemplateRuntimeProps({
  isPreview: false,
  auth: {
    isLoggedIn: true,
    username: 'private@example.test',
    email: 'private@example.test',
    avatar: 'https://private.example.test/avatar.png',
  },
});
assert(!JSON.stringify(emailFallbackProps).includes('private@example.test'));
assert(!JSON.stringify(emailFallbackProps).includes('avatar.png'));
const signedAvatarProps = runtimeClient.sanitizeTemplateRuntimeProps({
  isPreview: false,
  auth: {
    isLoggedIn: true,
    avatar: 'https://assets.supabase.co/avatar.png?token=private',
  },
});
assert(!JSON.stringify(signedAvatarProps).includes('token=private'));

const bridgeSource = await readFile(new URL('../lib/template-runtime-bridge.ts', import.meta.url), 'utf8');
const bridgeModule = ts.transpileModule(bridgeSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const bridge = await import(`data:text/javascript;base64,${Buffer.from(bridgeModule).toString('base64')}`);
const actionMessage = {
  protocol: 1,
  type: 'bagdja:template:action',
  slug: 'store-classic',
  version: '1.0.0',
  digest: 'a'.repeat(64),
  requestId: '23b5f7bc-2b0d-4c79-8f1b-a88dc5ed9293',
  action: {
    type: 'cart.add',
    productId: 'c2fb4f3d-b4e8-4221-b73d-334d87317218',
    quantity: 2,
  },
};
assert.deepEqual(bridge.parseTemplateRuntimeActionMessage(actionMessage)?.action, actionMessage.action);
assert.equal(
  bridge.parseTemplateRuntimeActionMessage({ ...actionMessage, action: { ...actionMessage.action, quantity: 0 } }),
  null,
);
assert.equal(
  bridge.parseTemplateRuntimeActionMessage({ ...actionMessage, action: { type: 'checkout.pay' } }),
  null,
);
const navigationMessage = {
  protocol: 1,
  type: 'bagdja:template:navigate',
  slug: 'store-classic',
  version: '1.0.0',
  digest: 'a'.repeat(64),
  href: 'https://tenant.example.test/store/products',
};
assert.ok(bridge.parseTemplateRuntimeNavigationMessage(navigationMessage));
assert.equal(
  bridge.getAllowedTemplateNavigationUrl(navigationMessage.href, 'https://tenant.example.test', '/store')?.pathname,
  '/store/products',
);
assert.equal(
  bridge.getAllowedTemplateNavigationUrl('https://attacker.example.test/store/products', 'https://tenant.example.test', '/store'),
  null,
);
assert.equal(
  bridge.getAllowedTemplateNavigationUrl('https://tenant.example.test/other-tenant', 'https://tenant.example.test', '/store'),
  null,
);
const sentResponses = [];
const calls = [];
const frame = { postMessage: (message, targetOrigin) => sentResponses.push({ message, targetOrigin }) };
const handleAction = bridge.createTemplateRuntimeActionBridge({
  frame,
  identity: { slug: actionMessage.slug, version: actionMessage.version, digest: actionMessage.digest },
  onAction: async (action) => {
    calls.push(action);
    return { orderId: 'order-123' };
  },
});
const sendAction = (data, source = frame, origin = 'null') =>
  handleAction({ data, source, origin });
await sendAction(actionMessage, {}, 'null');
await sendAction({ ...actionMessage, digest: 'b'.repeat(64) });
assert.equal(calls.length, 0, 'messages from another frame or digest must be ignored');
await sendAction(actionMessage);
await sendAction(actionMessage);
assert.equal(calls.length, 1, 'a request ID must not execute more than once');
assert.equal(sentResponses[0].targetOrigin, '*', 'opaque sandbox origins require a wildcard response target');
assert.deepEqual(sentResponses[0].message.result, { ok: true, orderId: 'order-123' });

const cartRequests = [];
const cartAdded = [];
const cartActionHandler = bridge.createCartAddActionHandler({
  websiteId: '15d54ec2-758f-4fb9-91a6-f65ab33d1e87',
  products: [{
    id: actionMessage.action.productId,
    websiteId: '15d54ec2-758f-4fb9-91a6-f65ab33d1e87',
    type: 'physical',
    name: 'Sample',
    slug: 'sample',
    price: 25000,
    priceLabel: 'Rp25.000',
  }],
  fetchImpl: async (url, init) => {
    cartRequests.push({ url, init });
    return new Response(JSON.stringify({ id: 'order-456' }), { status: 201 });
  },
  onAdded: (orderId) => cartAdded.push(orderId),
});
assert.deepEqual(await cartActionHandler(actionMessage.action), { orderId: 'order-456' });
assert.equal(cartRequests[0].url, '/api/orders');
assert.deepEqual(JSON.parse(cartRequests[0].init.body), {
  website_id: '15d54ec2-758f-4fb9-91a6-f65ab33d1e87',
  product_id: actionMessage.action.productId,
  quantity: 2,
});
assert.deepEqual(cartAdded, ['order-456']);
const unavailableProductHandler = bridge.createCartAddActionHandler({
  websiteId: '15d54ec2-758f-4fb9-91a6-f65ab33d1e87',
  products: [{
    id: actionMessage.action.productId,
    websiteId: 'another-tenant',
    type: 'physical',
    name: 'Wrong tenant',
    slug: 'wrong-tenant',
    priceLabel: 'Rp25.000',
  }],
  fetchImpl: async () => {
    throw new Error('Must not call BFF for a product owned by another tenant.');
  },
});
await assert.rejects(() => unavailableProductHandler(actionMessage.action));
const authRequiredHandler = bridge.createCartAddActionHandler({
  websiteId: '15d54ec2-758f-4fb9-91a6-f65ab33d1e87',
  products: [{
    id: actionMessage.action.productId,
    type: 'physical',
    name: 'Sample',
    slug: 'sample',
    price: 25000,
    priceLabel: 'Rp25.000',
  }],
  fetchImpl: async () => new Response(JSON.stringify({ message: 'Not authenticated' }), { status: 401 }),
});
await assert.rejects(
  () => authRequiredHandler(actionMessage.action),
  (error) => error.code === 'authentication_required',
);

const previewSource = await readFile(path.join(process.cwd(), 'app/[website_slug]/%5F%5Fpreview/page.tsx'), 'utf8');
assert(
  previewSource.includes('view.tenant.website.template_runtime'),
  'Preview route must use the exact package version pinned to the tenant website.',
);
assert(previewSource.includes('renderTemplateThroughRuntime'), 'Preview route must call the private runtime service.');
assert(previewSource.includes('sanitizeTemplateRuntimeProps({'), 'Preview route must not expose auth PII to external templates.');
assert(
  previewSource.includes('getTemplateRuntimeTenantVersion(runtime.slug, runtime.version)'),
  'Tenant previews must only use the runtime for a pinned package template.',
);
assert(!previewSource.includes('clientBundle={'), 'Studio preview stays inert: template browser JavaScript is never executed in the editor.');
assert(previewSource.includes('TemplateRuntimeErrorView'), 'Preview route must display a fail-closed runtime error.');
const studioDraftRoute = await readFile(
  path.join(process.cwd(), 'app/api/template-runtime/studio-preview/route.ts'),
  'utf8',
);
assert(studioDraftRoute.includes("template.source !== 'package'"), 'Studio draft rendering must only use the runtime for package templates.');
assert(studioDraftRoute.includes('getTemplateRuntimeVersion(body.slug, body.version)'), 'Studio draft rendering must validate the exact requested version.');
assert(studioDraftRoute.includes('body.props.isPreview !== true'), 'Studio draft rendering must accept preview props only.');
assert(studioDraftRoute.includes("([key]) => key !== 'auth'"), 'Studio draft rendering must remove auth data.');
const templateStudioPreviewSource = await readFile(
  path.join(process.cwd(), 'app/templates/store-classic/page.tsx'),
  'utf8',
);
assert(
  !templateStudioPreviewSource.includes('renderTemplateThroughRuntime'),
  'The built-in Store Classic demo must never be replaced by an external runtime artifact.',
);
assert(
  templateStudioPreviewSource.includes('searchParams.preview'),
  'The external runtime must only serve the existing preview route.',
);

const previewComponent = await readFile(
  path.join(process.cwd(), 'components/preview/template-runtime-preview.tsx'),
  'utf8',
);
assert(previewComponent.includes('sandbox=""'), 'Runtime HTML must render in an opaque sandboxed iframe.');
assert(previewComponent.includes("script-src 'none'"), 'Runtime preview must deny template scripts.');
assert(previewComponent.includes("connect-src 'none'"), 'Runtime preview must deny network connections.');
assert(!previewComponent.includes('dangerouslySetInnerHTML'), 'Runtime HTML must not enter the renderer origin DOM.');
assert(previewComponent.includes('parsePreviewInboundMessage'), 'Runtime editor preview must validate Studio draft messages.');
assert(previewComponent.includes('draftEndpoint'), 'Runtime editor preview must render drafts through the private server adapter.');
assert(previewComponent.includes('setHighlightedSectionId'), 'Runtime editor preview must reflect selected-section highlighting.');

const publicHomeRoute = await readFile(path.join(process.cwd(), 'app/[website_slug]/page.tsx'), 'utf8');
const publicSubpageRoute = await readFile(path.join(process.cwd(), 'app/[website_slug]/[page_slug]/page.tsx'), 'utf8');
for (const [routeName, routeSource] of [['home', publicHomeRoute], ['subpage', publicSubpageRoute]]) {
  assert(routeSource.includes('renderPinnedTenantTemplate'), `Public ${routeName} must resolve approved runtime pins.`);
  assert(routeSource.includes('view.tenant.website.template_runtime'), `Public ${routeName} must use the API runtime decision for pinned package templates.`);
}

// Halaman sistem: header/detail transaksi milik template hanya bila manifest versi terpasang menyatakannya.
for (const route of ['cart', 'orders', 'tagihan', 'calendar', 'chat', 'checkout', 'order/[transaction_id]']) {
  const source = await readFile(path.join(process.cwd(), `app/[website_slug]/${route}/page.tsx`), 'utf8');
  assert(source.includes("templateOwnsPage(website, 'header')"), `${route} must gate the designer header on manifest pageOverrides.`);
  assert(!source.includes("=== 'store-classic'"), `${route} must not hardcode a template slug.`);
  assert(source.includes('hostRendererSlug(website)'), `${route} must fall back to the Bagdja renderer for package templates.`);
}

const tenantRuntimeRoute = await readFile(path.join(process.cwd(), 'lib/template-runtime-route.tsx'), 'utf8');
assert(tenantRuntimeRoute.includes('getTemplateRuntimeTenantVersion'), 'Tenant routes must select only pinned or explicitly allowlisted development runtime versions.');
assert(
  tenantRuntimeRoute.includes('sanitizeTemplateRuntimeProps(bridgeAvailable ? { ...props, bridgeVersion: 1 } : props)'),
  'Tenant runtime must sanitize props (no auth PII) before rendering, including the bridge flag.',
);
const intentRoute = await readFile(path.join(process.cwd(), 'app/api/template-intents/route.ts'), 'utf8');
assert(intentRoute.includes('sameOrigin(request)'), 'Template intents must only accept same-origin requests from the host frame.');
assert(intentRoute.includes('parseTemplateRuntimeIntent(record.intent)'), 'Template intents must be validated by the bridge parser.');
assert(intentRoute.includes('templateOwnsPage(tenant.website, pageType)'), 'Template intents require the package manifest to declare the page.');
assert(intentRoute.includes('createPageKeyFactory(user.userId)'), 'Template intent keys must be resolved against the buyer session.');

const publicFrame = await readFile(path.join(process.cwd(), 'components/template-runtime-ssr-frame.tsx'), 'utf8');
assert(publicFrame.includes('sandbox="allow-scripts"'), 'Public SSR frame must use the opaque script-only sandbox.');
assert(publicFrame.includes('clientBundle'), 'Public SSR frame must support the verified, version-approved client bundle.');
assert(!publicFrame.includes('allow-same-origin'), 'Public SSR frame must retain an opaque origin.');
const frameDocument = await readFile(path.join(process.cwd(), 'lib/template-runtime-ssr-document.ts'), 'utf8');
for (const directive of [
  "connect-src 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "navigate-to 'none'",
]) {
  assert(frameDocument.includes(directive), `Public SSR frame CSP must include ${directive}.`);
}
assert(frameDocument.includes('clientBundleSha256'), 'Browser bundle must be re-verified in the iframe document builder.');
assert(frameDocument.includes('resourceOrigins'), 'Frame image origins must be narrowed to the SSR markup resource set.');
assert(frameDocument.includes('event.preventDefault()'), 'SSR frame links must route through the host bridge.');
assert(frameDocument.includes('sanitizeTemplateHtml'), 'Untrusted SSR markup must be sanitized before insertion.');
const runtimeRoute = await readFile(path.join(process.cwd(), 'lib/template-runtime-route.tsx'), 'utf8');
assert(runtimeRoute.includes('template_client_bundle_disabled'), 'The emergency switch must report when published client bundles are globally disabled.');
assert(runtimeRoute.includes('clientBundle={rendered.clientBundle}'), 'Published client bundles must also be passed through designer header frames.');
assert(runtimeRoute.includes('isTemplateRuntimeClientBundleApproved(templateSlug, version)'), 'Published client bundles must pass the global emergency-disable switch.');

console.log('Template runtime Next.js adapter contract: OK');
