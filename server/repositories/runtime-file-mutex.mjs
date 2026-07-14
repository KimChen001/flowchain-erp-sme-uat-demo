import { resolve } from 'node:path'

const queues = new Map()

// JSON runtime writes are serialized only inside this Node.js process.
export const runtimeFileMutexLimitations = Object.freeze({
  processLocalMutex: true,
  multiProcessSafe: false,
})

export async function withRuntimeFileMutex(file, operation) {
  const key = resolve(file)
  const previous = queues.get(key) || Promise.resolve()
  let release
  const current = new Promise(resolve => { release = resolve })
  const queue = previous.then(() => current)
  queues.set(key, queue)
  await previous
  try { return await operation() }
  finally {
    release()
    if (queues.get(key) === queue) queues.delete(key)
  }
}
