import { preflightPlugin } from './compatibility.js'
import { OperationLog } from './operation-log.js'
import { OperationTasks } from './operation-tasks.js'

const noopProgress = { stage() {}, log() {} }

function progressOf(options) {
  return options?.progress ?? noopProgress
}

function withOperationOptions(options, progress) {
  return { ...options, progress, skipLog: true }
}

function operationError(error) {
  return error instanceof Error ? error.message : String(error)
}

export class DshPluginManager {
  constructor({ registry, profileManager, operationLog, installer, dshVersion, platform } = {}) {
    if (!registry || !profileManager) throw new TypeError('registry and profileManager are required')
    this.registry = registry
    this.profileManager = profileManager
    this.operationLog = operationLog ?? new OperationLog(`${profileManager.rootDir}/plugin-manager/operations.jsonl`)
    this.installer = installer
    this.dshVersion = dshVersion
    this.platform = platform
    this.operationTasks = new OperationTasks({ operationLog: this.operationLog })
  }

  discover(filters) {
    return this.registry.search(filters)
  }

  async planInstall(id) {
    const plugin = this.registry.get(id)
    if (!plugin) throw new Error(`Plugin ${id} was not found in the registry`)
    const preflight = preflightPlugin({ plugin, dshVersion: this.dshVersion, platform: this.platform })
    return {
      plugin,
      preflight,
      actions: [
        `stage ${plugin.repository}`,
        `register ${plugin.packageName ?? plugin.name}`,
        `enable in profile ${this.profileManager.profile}`
      ],
      requiresConfirmation: preflight.warnings.length > 0
    }
  }

  /** Queue every mutating action so profile files are never changed concurrently. */
  startOperation(action, id, options = {}) {
    const supported = new Set(['install', 'enable', 'disable', 'update', 'rollback', 'uninstall'])
    if (!supported.has(action)) throw new Error(`Unsupported operation: ${action}`)
    return this.operationTasks.enqueue({
      action,
      pluginId: id,
      run: (progress) => this[action](id, withOperationOptions({
        ...options,
        // An install from the manager means “install and make available”.
        enable: action === 'install' ? options.enable !== false : options.enable
      }, progress))
    })
  }

  async getOperation(operationId) {
    const live = this.operationTasks.get(operationId)
    if (live) return live
    const history = await this.operationLog.list({ limit: 200 })
    const record = history.find((entry) => entry.operationId === operationId)
    return record ? this.#historySnapshot(record) : null
  }

  async listOperations({ limit = 80 } = {}) {
    const live = this.operationTasks.list({ limit, includeLogs: true })
    const liveIds = new Set(live.map((entry) => entry.operationId))
    const history = (await this.operationLog.list({ limit }))
      .filter((entry) => !entry.operationId || !liveIds.has(entry.operationId))
      .map((entry) => this.#historySnapshot(entry))
    return [...live, ...history]
      .sort((left, right) => String(right.createdAt ?? right.finishedAt ?? '').localeCompare(String(left.createdAt ?? left.finishedAt ?? '')))
      .slice(0, limit)
  }

  async install(id, options = {}) {
    const progress = progressOf(options)
    const plan = await this.planInstall(id)
    progress.stage('preflight')
    progress.log(`检查 ${plan.plugin.name ?? id} 的兼容性…`)
    if (!plan.preflight.ok) throw new Error(`Preflight failed: ${plan.preflight.issues.join('; ')}`)

    const profileSnapshot = await this.profileManager.snapshot()
    let artifact
    try {
      progress.stage('download')
      progress.log(`准备 ${plan.plugin.repository ?? id}…`)
      artifact = this.installer
        ? await this.installer.install(plan.plugin, {
          profileDir: this.profileManager.profileDir,
          allowScripts: options.allowScripts,
          onLog: (line, stream) => progress.log(line, stream)
        })
        : null

      progress.stage('register')
      progress.log('写入 DSH profile…')
      const result = await this.profileManager.install(plan.plugin, {
        ...options,
        artifactBackupId: artifact?.backupId,
        version: artifact?.version ?? options.version,
        packageName: artifact?.packageName ?? plan.plugin.packageName
      })

      let enabled = result
      if (options.enable === true) {
        progress.stage('enable')
        progress.log('启用插件…')
        enabled = await this.profileManager.enable(id)
      }

      progress.stage('verify')
      progress.log(options.enable === true
        ? '安装并启用完成。部分插件可能需要刷新或重启 DSH。'
        : '安装完成。插件尚未启用。')

      if (!options.skipLog) await this.operationLog.append({
        type: 'install', pluginId: id, status: 'success', enabled: options.enable === true
      })
      return { plan, artifact, result: enabled }
    } catch (error) {
      if (artifact?.backupId && this.installer) await this.installer.rollback(artifact.backupId)
      await this.profileManager.restoreSnapshot(profileSnapshot.id)
      if (!options.skipLog) await this.operationLog.append({
        type: 'install', pluginId: id, status: 'failed', error: operationError(error)
      })
      throw error
    }
  }

  async enable(id, options = {}) {
    const progress = progressOf(options)
    progress.stage('enable')
    progress.log('启用插件…')
    const result = await this.profileManager.enable(id)
    progress.stage('verify')
    progress.log(result.restartRequired ? '已启用配置；需要刷新或重启 DSH 才能加载。' : '插件已启用。')
    if (!options.skipLog) await this.operationLog.append({ type: 'enable', pluginId: id, status: 'success' })
    return result
  }

  async disable(id, options = {}) {
    const progress = progressOf(options)
    progress.stage('disable')
    progress.log('停用插件…')
    const result = await this.profileManager.disable(id)
    progress.stage('verify')
    progress.log(result.restartRequired ? '已停用配置；需要刷新或重启 DSH 才能生效。' : '插件已停用。')
    if (!options.skipLog) await this.operationLog.append({ type: 'disable', pluginId: id, status: 'success' })
    return result
  }

  async uninstall(id, options = {}) {
    const progress = progressOf(options)
    const plugin = (await this.profileManager.list()).find((entry) => entry.id === id)
    if (!plugin) throw new Error(`Plugin ${id} is not installed`)
    const profileSnapshot = await this.profileManager.snapshot()
    let artifact
    try {
      progress.stage('remove-profile')
      progress.log('从 DSH profile 中移除插件…')
      const result = await this.profileManager.uninstall(id)
      if (this.installer) {
        progress.stage('remove-files')
        progress.log(`删除 ${plugin.packageName ?? plugin.name} 文件…`)
        artifact = await this.installer.uninstall(plugin, { profileDir: this.profileManager.profileDir })
      }
      progress.stage('verify')
      progress.log('卸载完成。')
      if (!options.skipLog) await this.operationLog.append({ type: 'uninstall', pluginId: id, status: 'success' })
      return result
    } catch (error) {
      if (artifact?.backupId && this.installer) await this.installer.rollback(artifact.backupId)
      await this.profileManager.restoreSnapshot(profileSnapshot.id)
      if (!options.skipLog) await this.operationLog.append({
        type: 'uninstall', pluginId: id, status: 'failed', error: operationError(error)
      })
      throw error
    }
  }

  async update(id, options = {}) {
    const progress = progressOf(options)
    const installed = (await this.profileManager.list()).find((entry) => entry.id === id)
    if (!installed) throw new Error(`Plugin ${id} is not installed`)
    const candidate = this.registry.get(id) ?? installed
    const preflight = preflightPlugin({ plugin: { ...installed, ...candidate }, dshVersion: this.dshVersion, platform: this.platform })
    if (!preflight.ok) throw new Error(`Preflight failed: ${preflight.issues.join('; ')}`)

    const profileSnapshot = await this.profileManager.snapshot()
    let artifact
    try {
      progress.stage('download')
      progress.log(`准备更新 ${installed.name ?? id}…`)
      artifact = this.installer
        ? await this.installer.install({ ...installed, ...candidate }, {
          profileDir: this.profileManager.profileDir,
          allowScripts: options.allowScripts,
          onLog: (line, stream) => progress.log(line, stream)
        })
        : null
      progress.stage('register')
      const result = await this.profileManager.update(id, {
        version: artifact?.version ?? options.version ?? candidate.version,
        commit: options.commit ?? candidate.commit,
        artifactBackupId: artifact?.backupId
      })
      progress.stage('verify')
      progress.log(result.restartRequired ? '更新完成；需要刷新或重启 DSH 才能加载新版本。' : '更新完成。')
      if (!options.skipLog) await this.operationLog.append({ type: 'update', pluginId: id, status: 'success' })
      return { preflight, artifact, result }
    } catch (error) {
      if (artifact?.backupId && this.installer) await this.installer.rollback(artifact.backupId)
      await this.profileManager.restoreSnapshot(profileSnapshot.id)
      if (!options.skipLog) await this.operationLog.append({
        type: 'update', pluginId: id, status: 'failed', error: operationError(error)
      })
      throw error
    }
  }

  async rollback(id, options = {}) {
    const progress = progressOf(options)
    const installed = (await this.profileManager.list()).find((entry) => entry.id === id)
    if (!installed) throw new Error(`Plugin ${id} is not installed`)
    progress.stage('rollback')
    progress.log('恢复上一个插件版本…')
    if (installed.artifactBackupId && this.installer) await this.installer.rollback(installed.artifactBackupId)
    const result = await this.profileManager.rollbackPlugin(id)
    progress.stage('verify')
    progress.log('回滚完成；需要刷新或重启 DSH 才能加载。')
    if (!options.skipLog) await this.operationLog.append({ type: 'rollback', pluginId: id, status: 'success' })
    return result
  }

  #historySnapshot(entry) {
    return {
      operationId: entry.operationId ?? null,
      action: entry.action ?? entry.type,
      pluginId: entry.pluginId,
      status: entry.status === 'success' ? 'completed' : entry.status,
      stage: entry.stage === 'success' || (!entry.stage && entry.status === 'success') ? 'completed' : (entry.stage ?? entry.status),
      progress: entry.progress ?? (entry.status === 'success' ? 100 : 0),
      createdAt: entry.timestamp ?? entry.startedAt ?? entry.finishedAt ?? null,
      startedAt: entry.startedAt ?? null,
      finishedAt: entry.finishedAt ?? entry.timestamp ?? null,
      error: entry.error ?? null,
      result: null,
      logs: entry.logs ?? []
    }
  }
}
