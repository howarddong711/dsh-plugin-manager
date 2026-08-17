import { randomUUID } from 'node:crypto'

const DEFAULT_LOG_LIMIT = 600
const DEFAULT_OPERATION_LIMIT = 80
const STAGE_PROGRESS = {
  queued: 0,
  preflight: 12,
  download: 34,
  register: 58,
  enable: 74,
  disable: 68,
  'remove-profile': 42,
  'remove-files': 70,
  rollback: 58,
  verify: 90,
  completed: 100,
  failed: 100
}

function progressForStage(stage) {
  return STAGE_PROGRESS[stage] ?? 0
}

function snapshot(operation, includeLogs = true) {
  return {
    operationId: operation.operationId,
    action: operation.action,
    pluginId: operation.pluginId,
    status: operation.status,
    stage: operation.stage,
    progress: operation.progress,
    createdAt: operation.createdAt,
    startedAt: operation.startedAt ?? null,
    finishedAt: operation.finishedAt ?? null,
    error: operation.error ?? null,
    result: operation.result ?? null,
    ...(includeLogs ? { logs: [...operation.logs] } : {})
  }
}

/**
 * Serializes profile mutations and keeps a small, queryable live operation
 * projection for the independent Plugin Manager page.
 */
export class OperationTasks {
  constructor({ operationLog, logLimit = DEFAULT_LOG_LIMIT, operationLimit = DEFAULT_OPERATION_LIMIT } = {}) {
    if (!operationLog) throw new TypeError('operationLog is required')
    this.operationLog = operationLog
    this.logLimit = logLimit
    this.operationLimit = operationLimit
    this.records = new Map()
    this.tail = Promise.resolve()
  }

  enqueue({ action, pluginId, run } = {}) {
    if (!action || !pluginId || typeof run !== 'function') {
      throw new TypeError('action, pluginId, and run are required')
    }

    const operation = {
      operationId: `op-${randomUUID()}`,
      action,
      pluginId,
      status: 'queued',
      stage: 'queued',
      progress: 0,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      error: null,
      result: null,
      logs: [],
      listeners: new Set()
    }
    this.records.set(operation.operationId, operation)
    this.#trim()

    const job = this.tail.then(() => this.#execute(operation, run))
    this.tail = job.catch(() => {})
    return snapshot(operation)
  }

  get(operationId) {
    const operation = this.records.get(operationId)
    return operation ? snapshot(operation) : null
  }

  list({ limit = this.operationLimit, includeLogs = false } = {}) {
    return [...this.records.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
      .map((operation) => snapshot(operation, includeLogs))
  }

  subscribe(operationId, listener) {
    const operation = this.records.get(operationId)
    if (!operation || typeof listener !== 'function') return () => {}
    operation.listeners.add(listener)
    listener(snapshot(operation))
    return () => operation.listeners.delete(listener)
  }

  async wait(operationId) {
    const operation = this.records.get(operationId)
    if (!operation) return null
    while (operation.status === 'queued' || operation.status === 'running') {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    return snapshot(operation)
  }

  async #execute(operation, run) {
    operation.status = 'running'
    operation.stage = 'preflight'
    operation.progress = progressForStage('preflight')
    operation.startedAt = new Date().toISOString()
    this.#emit(operation)

    const context = {
      stage: (stage) => {
        operation.stage = String(stage)
        operation.progress = progressForStage(operation.stage)
        this.#emit(operation)
      },
      log: (message, stream = 'stdout') => {
        const text = String(message ?? '').trimEnd()
        if (!text) return
        for (const line of text.split(/\r?\n/)) {
          if (!line) continue
          operation.logs.push({ timestamp: new Date().toISOString(), stream, line })
        }
        if (operation.logs.length > this.logLimit) {
          operation.logs.splice(0, operation.logs.length - this.logLimit)
        }
        this.#emit(operation)
      }
    }

    try {
      operation.result = await run(context)
      operation.status = 'completed'
      operation.stage = 'completed'
      operation.progress = 100
      operation.finishedAt = new Date().toISOString()
      await this.#persist(operation)
      this.#emit(operation)
    } catch (error) {
      operation.status = 'failed'
      operation.stage = 'failed'
      operation.error = error instanceof Error ? error.message : String(error)
      operation.finishedAt = new Date().toISOString()
      context.log(operation.error, 'stderr')
      await this.#persist(operation)
      this.#emit(operation)
    }

    return snapshot(operation)
  }

  async #persist(operation) {
    await this.operationLog.append({
      operationId: operation.operationId,
      action: operation.action,
      pluginId: operation.pluginId,
      status: operation.status,
      stage: operation.stage,
      progress: operation.progress,
      startedAt: operation.startedAt,
      finishedAt: operation.finishedAt,
      error: operation.error,
      logs: operation.logs
    })
  }

  #emit(operation) {
    const value = snapshot(operation)
    for (const listener of operation.listeners) {
      try {
        listener(value)
      } catch {
        // A disconnected browser must never break an installation task.
      }
    }
  }

  #trim() {
    const completed = [...this.records.values()]
      .filter((operation) => operation.status === 'completed' || operation.status === 'failed')
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    while (this.records.size > this.operationLimit && completed.length > 0) {
      const oldest = completed.shift()
      if (oldest) this.records.delete(oldest.operationId)
    }
  }
}

export { DEFAULT_LOG_LIMIT, DEFAULT_OPERATION_LIMIT, progressForStage }
