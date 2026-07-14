import { capabilityRegistryForEnvironment } from '../domain/capability-registry.mjs'

export async function handleCapabilitiesRoute({ req, res, url, send, env = process.env }) {
  if (req.method !== 'GET' || url.pathname !== '/api/capabilities') return false
  send(res, 200, { capabilities: capabilityRegistryForEnvironment(env) })
  return true
}
