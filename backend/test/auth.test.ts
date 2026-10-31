import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword, issueToken, verifyToken } from '../src/api/middleware/auth.js';

test('scrypt passwords are salted and verified', async () => {
  const password = 'correct-horse-battery-staple';
  const first = await hashPassword(password);
  assert.notEqual(first, await hashPassword(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('wrong password', first), false);
  assert.equal(await verifyPassword(password, 'malformed'), false);
});
test('JWT verifies signature and user identity', () => {
  const userId = randomUUID();
  const secret = 'a'.repeat(64);
  const token = issueToken(userId, secret);
  assert.equal(verifyToken(token, secret).userId, userId);
  assert.throws(() => verifyToken(token, 'b'.repeat(64)));
  assert.throws(() => verifyToken('malformed', secret));
});
