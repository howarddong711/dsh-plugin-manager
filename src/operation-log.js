import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export class OperationLog {
  constructor(filePath) {
    if (!filePath) throw new TypeError('Operation log path is required')
    this.filePath = filePath
  }

  async append(event) {
    const record = {
      timestamp: new Date().toISOString(),
      ...event
    }
    await mkdir(join(this.filePath, '..'), { recursive: true })
    await appendFile(this.filePath, `${JSON.stringify(record)}\n`, 'utf8')
    return record
  }

  async list({ limit = 100 } = {}) {
    try {
      const content = await readFile(this.filePath, 'utf8')
      return content
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .slice(-limit)
    } catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
  }
}
