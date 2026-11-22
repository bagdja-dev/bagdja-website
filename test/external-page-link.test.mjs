import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildPageHref, navLinkTargetProps, resolveExternalPageUrl, resolveFeatureLink } from '../lib/page-link.ts';

// Sama dengan toNavPage() di lib/template-data.ts.
function toNavPage(page) {
  return { slug: page.slug, title: page.title, isHome: page.is_home, placement: page.placement, externalUrl: resolveExternalPageUrl(page) };
}

function page(overrides = {}) {
  return {
    id: 'p1',
    website_id: 'w1',
    name: 'Promo',
    title: 'Promo',
    slug: 'promo',
    content: {},
    is_home: false,
    placement: 'header',
    order: 1,
    ...overrides,
  };
}

test('halaman tautan eksternal menuju URL tujuan, bukan /slug', () => {
  const nav = toNavPage(page({ link_mode: 'external', external_url: 'https://shopee.co.id/toko' }));
  assert.equal(buildPageHref('', nav), 'https://shopee.co.id/toko');
  assert.equal(buildPageHref('/toko-saya', nav), 'https://shopee.co.id/toko');
  assert.deepEqual(navLinkTargetProps(buildPageHref('', nav)), { target: '_blank', rel: 'noopener noreferrer' });
});

test('halaman internal tetap ke /slug dan dibuka di tab yang sama', () => {
  const nav = toNavPage(page({ link_mode: 'internal', external_url: 'https://diabaikan.test' }));
  assert.equal(buildPageHref('', nav), '/promo');
  assert.equal(buildPageHref('/toko-saya', nav), '/toko-saya/promo');
  assert.deepEqual(navLinkTargetProps('/promo'), {});
  // Data lama tanpa link_mode = internal.
  assert.equal(buildPageHref('', toNavPage(page())), '/promo');
});

test('URL eksternal dinormalisasi dan skema berbahaya ditolak', () => {
  assert.equal(resolveExternalPageUrl({ link_mode: 'external', external_url: ' www.contoh.com/a ' }), 'https://www.contoh.com/a');
  assert.equal(resolveExternalPageUrl({ link_mode: 'external', external_url: 'mailto:halo@contoh.com' }), 'mailto:halo@contoh.com');
  assert.equal(resolveExternalPageUrl({ link_mode: 'external', external_url: 'javascript:alert(1)' }), undefined);
  assert.equal(resolveExternalPageUrl({ link_mode: 'external', external_url: '   ' }), undefined);
  assert.equal(resolveExternalPageUrl({ link_mode: 'external', external_url: null }), undefined);
  assert.deepEqual(navLinkTargetProps('mailto:halo@contoh.com'), {});
});

test('link kartu keunggulan menerima URL umum dan path relatif, serta menolak skema berbahaya', () => {
  assert.equal(resolveFeatureLink('www.contoh.com/promo'), 'https://www.contoh.com/promo');
  assert.equal(resolveFeatureLink('/layanan'), '/layanan');
  assert.equal(resolveFeatureLink('#harga'), '#harga');
  assert.equal(resolveFeatureLink('mailto:halo@contoh.com'), 'mailto:halo@contoh.com');
  assert.equal(resolveFeatureLink('javascript:alert(1)'), undefined);
  assert.equal(resolveFeatureLink('   '), undefined);
});
