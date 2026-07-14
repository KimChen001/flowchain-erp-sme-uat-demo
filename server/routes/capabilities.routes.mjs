import { capabilityRegistry } from '../domain/capability-registry.mjs'

export async function handleCapabilitiesRoute({ req, res, url, send }) {
  if (req.method !== 'GET' || url.pathname !== '/api/capabilities') return false
  send(res, 200, { capabilities: capabilityRegistry })
  return true
}
