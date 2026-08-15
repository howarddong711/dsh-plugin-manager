import { preflightPlugin } from './compatibility.js'
import { OperationLog } from './operation-log.js'

export class DshPluginManager {
  constructor({ registry, profileManager, operationLog, installer, dshVersion, platform } = {}) {
    if (!registry || !profileManager) throw new TypeError('registry and profileManager are required')
    this.registry = registry
    this.profileManager = profileManager
    this.operationLog = operationLog ?? new OperationLog(`${profileManager.rootDir}/plugin-manager/operations.jsonl`)
    this.installer = installer
    this.dshVersion = dshVersion
    this.platform = platform
  }

  discover(filters) {
    return this.registry.search(filters)
  }

  async planInstall(id) {
    const plugin = this.registry.get(id)
    if (!plugin) throw new Error(`Plugin ${id} was not found in the registry`)

    const preflight = preflightPlugin({
      plugin,
      dshVersion: this.dshVersion,
      platform: this.platform
    })

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

  async install(id, options = {}) {
    const plan = await this.planInstall(id)
    if (!plan.preflight.ok) throw new Error(`Preflight failed: ${plan.preflight.issues.join('; ')}`)
    const artifact = this.installer
      ? await this.installer.install(plan.plugin, {
        profileDir: this.profileManager.profileDir,
        allowScripts: options.allowScripts
      })
      : null
    let result
    try {
      result = await this.profileManager.install(plan.plugin, {
        ...options,
        artifactBackupId: artifact?.backupId,
        version: artifact?.version ?? options.version,
        packageName: artifact?.packageName ?? plan.plugin.packageName
      })
    } catch (error) {
      if (artifact?.backupId && this.installer) await this.installer.rollback(artifact.backupId)
      throw error
    }
    await this.operationLog.append({ type: 'install', pluginId: id, status: 'success' })
    return { plan, artifact, result }
  }

  async enable(id) {
    const result = await this.profileManager.enable(id)
    await this.operationLog.append({ type: 'enable', pluginId: id, status: 'success' })
    return result
  }

  async disable(id) {
    const result = await this.profileManager.disable(id)
    await this.operationLog.append({ type: 'disable', pluginId: id, status: 'success' })
    return result
  }

  async uninstall(id) {
    const plugin = (await this.profileManager.list()).find((entry) => entry.id === id)
    let artifact
    if (this.installer && plugin) {
      artifact = await this.installer.uninstall(plugin, { profileDir: this.profileManager.profileDir })
    }
    let result
    try {
      result = await this.profileManager.uninstall(id)
    } catch (error) {
      if (artifact?.backupId && this.installer) await this.installer.rollback(artifact.backupId)
      throw error
    }
    await this.operationLog.append({ type: 'uninstall', pluginId: id, status: 'success' })
    return result
  }

  async update(id, options = {}) {
    const installed = (await this.profileManager.list()).find((entry) => entry.id === id)
    if (!installed) throw new Error(`Plugin ${id} is not installed`)
    const candidate = this.registry.get(id) ?? installed
    const preflight = preflightPlugin({ plugin: { ...installed, ...candidate }, dshVersion: this.dshVersion, platform: this.platform })
    if (!preflight.ok) throw new Error(`Preflight failed: ${preflight.issues.join('; ')}`)

    const profileSnapshot = await this.profileManager.snapshot()
    let artifact
    try {
      artifact = this.installer
        ? await this.installer.install({ ...installed, ...candidate }, {
          profileDir: this.profileManager.profileDir,
          allowScripts: options.allowScripts
        })
        : null
      const result = await this.profileManager.update(id, {
        version: artifact?.version ?? options.version ?? candidate.version,
        commit: options.commit ?? candidate.commit,
        artifactBackupId: artifact?.backupId
      })
      await this.operationLog.append({ type: 'update', pluginId: id, status: 'success' })
      return { preflight, artifact, result }
    } catch (error) {
      if (artifact?.backupId && this.installer) await this.installer.rollback(artifact.backupId)
      await this.profileManager.restoreSnapshot(profileSnapshot.id)
      await this.operationLog.append({ type: 'update', pluginId: id, status: 'failed', error: error.message })
      throw error
    }
  }

  async rollback(id) {
    const installed = (await this.profileManager.list()).find((entry) => entry.id === id)
    if (!installed) throw new Error(`Plugin ${id} is not installed`)
    if (installed.artifactBackupId && this.installer) {
      await this.installer.rollback(installed.artifactBackupId)
    }
    const result = await this.profileManager.rollbackPlugin(id)
    await this.operationLog.append({ type: 'rollback', pluginId: id, status: 'success' })
    return result
  }
}
