import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildCustomHtmlSandboxCsp,
  CUSTOM_HTML_SANDBOX_DOCUMENT,
  CUSTOM_HTML_SANDBOX_FLAGS,
  DEFAULT_CUSTOM_HTML_ASSET_ORIGINS,
  parseAssetOrigins,
} from '../lib/custom-html-sandbox.ts';

function directives(csp) {
  return new Map(csp.split(';').map((part) => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values.join(' ')];
  }));
}

test('CSP sandbox memblokir semua jalur jaringan keluar', () => {
  const policy = directives(buildCustomHtmlSandboxCsp(['https://cdn.bagdja.com']));
  assert.equal(policy.get('connect-src'), "'none'");
  assert.equal(policy.get('form-action'), "'none'");
  assert.equal(policy.get('frame-src'), "'none'");
  assert.equal(policy.get('worker-src'), "'none'");
  assert.equal(policy.get('default-src'), "'none'");
  assert.equal(policy.get('base-uri'), "'none'");
  assert.equal(policy.get('img-src'), 'data: blob: https://cdn.bagdja.com');
});

test('CSP sandbox memaksa origin opaque (tanpa allow-same-origin)', () => {
  const policy = directives(buildCustomHtmlSandboxCsp(DEFAULT_CUSTOM_HTML_ASSET_ORIGINS));
  assert.equal(policy.get('sandbox'), CUSTOM_HTML_SANDBOX_FLAGS);
  assert.ok(CUSTOM_HTML_SANDBOX_FLAGS.includes('allow-scripts'));
  assert.ok(!CUSTOM_HTML_SANDBOX_FLAGS.includes('allow-same-origin'));
  assert.ok(!CUSTOM_HTML_SANDBOX_FLAGS.includes('allow-top-navigation '));
});

test('origin aset dari env hanya menerima origin https yang valid', () => {
  assert.deepEqual(
    parseAssetOrigins('https://cdn.bagdja.com/, https://*.r2.dev  http://evil.test https://x.test; script-src * https://ok.test'),
    ['https://cdn.bagdja.com', 'https://*.r2.dev', 'https://ok.test'],
  );
  assert.deepEqual(parseAssetOrigins(''), DEFAULT_CUSTOM_HTML_ASSET_ORIGINS);
  assert.deepEqual(parseAssetOrigins("'unsafe-inline'"), DEFAULT_CUSTOM_HTML_ASSET_ORIGINS);
});

test('bootstrap hanya menerima render dari window.parent dan sekali saja', () => {
  assert.match(CUSTOM_HTML_SANDBOX_DOCUMENT, /event\.source !== parentWindow/);
  assert.match(CUSTOM_HTML_SANDBOX_DOCUMENT, /if \(rendered \|\|/);
  assert.match(CUSTOM_HTML_SANDBOX_DOCUMENT, /parentWindow === window\) return/);
});
