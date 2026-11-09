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
  createTemplateRuntimeSsrDocument,
  isTemplateRuntimeResizeMessage,
} = helperModule.exports;
const identity = { slug: 'storefront-demo', version: '1.2.3', digest: 'a'.repeat(64) };
globalThis.window = { btoa, crypto: webcrypto };
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
const { getAllowedTemplateNavigationUrl } = bridgeModule.exports;
globalThis.DOMParser = class {
  parseFromString(markup) {
    const body = markup.match(/<body>([\s\S]*)<\/body>/i)?.[1]
      ?? markup.replace(/^.*?<body>/is, '');
    const sanitizedBody = body
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<(?:meta|base|iframe|frame|object|embed|form)\b[^>]*\/?>/gi, '')
      .replace(/<link\b(?=[^>]*\brel\s*=\s*['"]?import\b)[^>]*\/?>/gi, '');
    return {
      body: { innerHTML: sanitizedBody },
      querySelectorAll: () => [],
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
  const expectedBootstrapHash = createHash('sha256').update(bootstrap).digest('base64');
  const escapedPolicy = document.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.ok(escapedPolicy);
  const policy = escapedPolicy.replaceAll('&#39;', "'");
  assert.ok(policy.includes(`script-src 'sha256-${expectedBootstrapHash}'`));
  assert.ok(policy.includes("connect-src 'none'"));
  assert.ok(policy.includes("form-action 'none'"));
  assert.ok(policy.includes("frame-src 'none'"));
  assert.ok(policy.includes("worker-src 'none'"));
  assert.ok(bootstrap.includes("type: 'bagdja:template:navigate'"));
  assert.ok(bootstrap.includes("url.hostname === 'wa.me'"));
  assert.ok(bootstrap.includes('event.preventDefault()'));
  assert.ok(document.includes('https://tenant.example.test/_next/static/css/site.css'));
  assert.ok(!document.includes('attacker.example.test'));
  assert.ok(!document.includes('window.pwned'));
  assert.ok(!document.includes('http-equiv="refresh"'));
  assert.ok(!document.includes('<iframe src="https://evil.test"'));
  assert.ok(document.includes('<main>Rendered</main>'));
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
