import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalSession, issueLocalSessionToken, resolveRequestIdentity } from './local-signed-session.mjs'

test('signed identity owns tenant context and ignores forged tenant headers', () => {
  const env = { FLOWCHAIN_DEFAULT_TENANT_ID: 'tenant-server-owned' }
  const secret = 'tenant-test-secret'
  const session = createLocalSession({ name: 'Manager', email: 'manager@example.com', company: 'FlowChain' }, { env })
  const token = issueLocalSessionToken(session, secret)
  const identity = resolveRequestIdentity({
    headers: {
      authorization: `Bearer ${token}`,
      'x-flowchain-tenant': 'tenant-forged',
      'x-flowchain-role': 'viewer',
    },
  }, new Map([[session.sessionId, session]]), secret, env)

  assert.equal(identity.authenticated, true)
  assert.equal(identity.tenantId, 'tenant-server-owned')
  assert.equal(identity.role, 'manager')
})

test('test identity headers still use only the server tenant default', () => {
  const identity = resolveRequestIdentity({
    headers: {
      'x-flowchain-user': 'test-manager',
      'x-flowchain-role': 'manager',
      'x-flowchain-tenant': 'tenant-forged',
    },
  }, new Map(), 'secret', {
    NODE_ENV: 'test',
    FLOWCHAIN_DEFAULT_TENANT_ID: 'tenant-test-server',
  })

  assert.equal(identity.tenantId, 'tenant-test-server')
  assert.equal(identity.userId, 'test-manager')
})

test('identity has no formal tenant context when the server default is absent', () => {
  const session = createLocalSession({ name: 'Manager', email: 'manager@example.com', company: 'FlowChain' }, { env: {} })
  const secret = 'tenant-test-secret'
  const token = issueLocalSessionToken(session, secret)
  const identity = resolveRequestIdentity({ headers: { authorization: `Bearer ${token}` } }, new Map([[session.sessionId, session]]), secret, {})
  assert.equal(identity.authenticated, true)
  assert.equal(identity.tenantId, '')
})

