export function isAiProviderEnabled(env = process.env) {
  return env.AI_PROVIDER_ENABLED === 'true'
}

export function getAiProviderSafetyState(env = process.env) {
  const enabled = isAiProviderEnabled(env)
  return {
    enabled,
    reason: enabled
      ? 'External AI provider access is explicitly enabled.'
      : 'External AI provider access is disabled by default.',
  }
}
