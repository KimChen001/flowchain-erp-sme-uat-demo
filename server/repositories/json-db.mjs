import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

export function createJsonDb(dataFile) {
  return {
    async read() {
      const raw = await readFile(dataFile, 'utf8')
      return JSON.parse(raw)
    },

    async write(db) {
      await mkdir(path.dirname(dataFile), { recursive: true })
      await writeFile(dataFile, JSON.stringify(db, null, 2), 'utf8')
    },
  }
}
