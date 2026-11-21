import assert from 'node:assert/strict';
import { test } from 'node:test';

import { matchesProductGridFilter, productGridFilter } from '../lib/product-grid-filter.ts';

test('product list section: type all/empty and empty categories show everything', () => {
  assert.deepEqual(productGridFilter({ filter_type: 'all', category_ids: [] }), { type: undefined, categoryIds: [] });
  assert.deepEqual(productGridFilter({}), { type: undefined, categoryIds: [] });
  assert.deepEqual(productGridFilter({}, 'service'), { type: 'service', categoryIds: [] }, 'old services sections keep their default');
  assert.deepEqual(productGridFilter({ filter_type: 'service', category_ids: ['c1', '', 7, 'c2'] }), { type: 'service', categoryIds: ['c1', 'c2'] });
});

test('product list section: matches by type and by any of the chosen categories', () => {
  const filter = productGridFilter({ filter_type: 'service', category_ids: ['c1', 'c2'] });
  assert.equal(matchesProductGridFilter({ type: 'service', categoryId: 'c2' }, filter), true);
  assert.equal(matchesProductGridFilter({ type: 'product', categoryId: 'c2' }, filter), false);
  assert.equal(matchesProductGridFilter({ type: 'service', categoryId: 'c3' }, filter), false);
  assert.equal(matchesProductGridFilter({ type: 'service' }, filter), false, 'uncategorised items are hidden when categories are chosen');
  assert.equal(matchesProductGridFilter({ type: 'gathering' }, productGridFilter({ filter_type: 'all' })), true);
});
