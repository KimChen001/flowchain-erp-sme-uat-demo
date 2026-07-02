const port = process.env.PLAYWRIGHT_API_PORT || '18787'

process.env.SCM_API_PORT = port

await import('../server/index.mjs')
