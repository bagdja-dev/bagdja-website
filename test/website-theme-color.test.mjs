import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getContrastTextColor, isHexColor } from '../lib/website-theme.ts';

test('validates hex colors before applying them to hero styles', () => {
  assert.equal(isHexColor('#AABBCC'), true);
  assert.equal(isHexColor('#abc'), false);
  assert.equal(isHexColor('red; background-image:url(x)'), false);
  assert.equal(isHexColor(undefined), false);
});

test('chooses a readable foreground for light and dark hero backgrounds', () => {
  assert.equal(getContrastTextColor('#ffffff'), '#111827');
  assert.equal(getContrastTextColor('#111827'), '#ffffff');
});
