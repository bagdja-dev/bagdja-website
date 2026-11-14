import test from 'node:test';
import assert from 'node:assert/strict';

const { sessionMaxAgeSeconds } = await import('../lib/session-max-age.ts');

const tokenWith = (payload) => `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;

test('session cookies live as long as the token (exp), not a fixed hour', () => {
  const now = 1_800_000_000_000;
  assert.equal(sessionMaxAgeSeconds(tokenWith({ exp: now / 1000 + 86400 }), now), 86400);
  assert.equal(sessionMaxAgeSeconds(tokenWith({ exp: now / 1000 + 3600 }), now), 3600);
});

test('session cookie lifetime is bounded and falls back to one hour', () => {
  const now = 1_800_000_000_000;
  assert.equal(sessionMaxAgeSeconds(tokenWith({ exp: now / 1000 + 30 * 86400 }), now), 7 * 86400);
  assert.equal(sessionMaxAgeSeconds(tokenWith({ exp: now / 1000 - 10 }), now), 60);
  assert.equal(sessionMaxAgeSeconds(tokenWith({ sub: 'x' }), now), 3600);
  assert.equal(sessionMaxAgeSeconds('not-a-jwt', now), 3600);
});
