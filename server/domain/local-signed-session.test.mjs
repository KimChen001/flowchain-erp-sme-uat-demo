import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalSession, issueLocalSessionToken, resolveRequestIdentity, verifyLocalSessionToken } from './local-signed-session.mjs'

test('local session token is signed, expires, and resolves server-owned role', () => {
  const secret = 'test-secret'; const now = Date.now()
  const session = createLocalSession({ name: 'Owner', email: 'owner@example.com', company: 'Runtime Co', role: 'admin' }, { now, ttlSeconds: 60 })
  const token = issueLocalSessionToken(session, secret, { now, ttlSeconds: 60 })
  assert.equal(session.role, 'manager')
  assert.equal(verifyLocalSessionToken(token, secret, { now }).valid, true)
  assert.equal(verifyLocalSessionToken(`${token}x`, secret, { now }).reason, 'invalid_signature')
  assert.equal(verifyLocalSessionToken(token, secret, { now: now + 61_000 }).reason, 'expired_token')
  const identity = resolveRequestIdentity({ headers: { authorization: `Bearer ${token}`, 'x-flowchain-role': 'admin' } }, new Map([[session.sessionId, session]]), secret, {})
  assert.equal(identity.role, 'manager')
  assert.equal(identity.source, 'local_signed_session')
})

test('identity headers are rejected by default and accepted only in explicit test mode', () => {
  const req = { headers: { 'x-flowchain-user': 'forged', 'x-flowchain-role': 'admin' } }
  assert.equal(resolveRequestIdentity(req, new Map(), 'secret', {}).role, 'viewer')
  assert.equal(resolveRequestIdentity(req, new Map(), 'secret', { FLOWCHAIN_ALLOW_TEST_IDENTITY_HEADERS: 'true' }).role, 'admin')
})
