const queues = new Map()

export async function withRuntimeFileMutex(file, operation) {
  const previous = queues.get(file) || Promise.resolve()
  let release
  const current = new Promise(resolve => { release = resolve })
  const queue = previous.then(() => current)
  queues.set(file, queue)
  await previous
  try { return await operation() }
  finally {
    release()
    if (queues.get(file) === queue) queues.delete(file)
  }
}
