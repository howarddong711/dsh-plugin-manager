import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const SUPPORTED_KINDS = new Set(['cordis-bundle', 'web-client'])

const emptyState = (profile) => ({
  schemaVersion: 1,
  profile,
  plugins: {},
  lastBackupId: null
})

async function exists(filePath) {
  try {
    await readFile(filePath)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

async function readJson(filePath, fallback) {
  if (!(await exists(filePath))) return fallback
  return JSON.parse(await readFile(filePath, 'utf8'))
}

export async function writeFileAtomic(filePath, content) {
  await mkdir(join(filePath, '..'), { recursive: true })
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, content, 'utf8')
  await rm(filePath, { force: true })
  await rename(temporaryPath, filePath)
}

function quote(value) {
  return JSON.stringify(String(value))
}

function packageSpec(plugin) {
  if (plugin.source === 'npm') return plugin.version ?? '*'
  if (plugin.source === 'local' && plugin.localPath) return `link:${resolve(plugin.localPath)}`

  const repository = plugin.repository ?? plugin.id
  if (typeof repository === 'string') {
    const githubRepository = repository
      .replace(/^https?:\/\/github\.com\//, '')
      .replace(/\.git$/, '')
    if (/^[^/]+\/[^/]+$/.test(githubRepository)) {
      return `github:${githubRepository}${plugin.commit ? `#${plugin.commit}` : ''}`
    }
  }
  return repository
}

function profileManifestEnabled(manifest) {
  return Array.isArray(manifest?.dsh?.profile?.bundles)
}

function syncProfileManifest(manifest, currentState, nextState) {
  if (!profileManifestEnabled(manifest)) return

  const currentPlugins = Object.values(currentState.plugins)
  const nextPlugins = Object.values(nextState.plugins)
  const ownedNames = new Set([...currentPlugins, ...nextPlugins]
    .map((plugin) => plugin.packageName)
    .filter(Boolean))
  const nextNames = new Set(nextPlugins.map((plugin) => plugin.packageName).filter(Boolean))
  const nextEnabled = nextPlugins
    .filter((plugin) => plugin.enabled && plugin.packageName)
    .map((plugin) => plugin.packageName)

  const profile = manifest.dsh.profile
  const existingBundles = profile.bundles.filter((bundle) => !ownedNames.has(bundle))
  profile.bundles = [...new Set([...existingBundles, ...nextEnabled])]

  const dependencies = manifest.dependencies && typeof manifest.dependencies === 'object'
    ? manifest.dependencies
    : (manifest.dependencies = {})
  for (const plugin of currentPlugins) {
    if (plugin.packageName && !nextNames.has(plugin.packageName)) delete dependencies[plugin.packageName]
  }
  for (const plugin of nextPlugins) {
    if (plugin.packageName) dependencies[plugin.packageName] = packageSpec(plugin)
  }
}

export function renderProfilePatch(state) {
  const enabled = Object.values(state.plugins)
    .filter((plugin) => plugin.enabled && SUPPORTED_KINDS.has(plugin.kind))
    .sort((left, right) => left.id.localeCompare(right.id))

  if (enabled.length === 0) return '[]\n'

  return [
    '- insert:',
    ...enabled.flatMap((plugin) => [
      `  - id: ${quote(`dsh-plugin-manager/${plugin.id}`)}`,
      `    name: ${quote(plugin.packageName ?? plugin.name)}`
    ]),
    ''
  ].join('\n')
}

export class ProfileManager {
  constructor({ rootDir, profile = 'web', write = writeFileAtomic } = {}) {
    if (!rootDir) throw new TypeError('rootDir is required')
    this.rootDir = rootDir
    this.profile = profile
    this.write = write
    this.profileDir = join(rootDir, 'profiles', profile)
    this.statePath = join(this.profileDir, 'manager-state.json')
    this.patchPath = join(this.profileDir, 'dsh-plugin-manager.patch.yml')
    this.profileManifestPath = join(this.profileDir, 'package.json')
    this.backupDir = join(rootDir, 'backups', profile)
  }

  async load() {
    await mkdir(this.profileDir, { recursive: true })
    return readJson(this.statePath, emptyState(this.profile))
  }

  async list() {
    const state = await this.load()
    return Object.values(state.plugins)
  }

  async install(plugin, { version, packageName, artifactBackupId, source = plugin.source ?? 'github' } = {}) {
    this.#assertSupported(plugin)
    return this.#mutate((state) => {
      state.plugins[plugin.id] = {
        id: plugin.id,
        name: plugin.name,
        repository: plugin.repository ?? plugin.id,
        packageName: packageName ?? plugin.packageName,
        kind: plugin.kind,
        version: version ?? plugin.version ?? null,
        source,
        localPath: plugin.localPath ?? null,
        commit: plugin.commit ?? null,
        enabled: false,
        managedBy: 'manager',
        restartRequired: false,
        artifactBackupId: artifactBackupId ?? null,
        installedAt: new Date().toISOString(),
        lastOperation: { type: 'install', status: 'success' }
      }
      return state.plugins[plugin.id]
    })
  }

  async enable(id) {
    return this.#mutate((state) => {
      const plugin = this.#requirePlugin(state, id)
      if (plugin.managedBy !== 'manager') throw new Error(`Plugin ${id} is externally managed`)
      plugin.enabled = true
      plugin.restartRequired = true
      plugin.lastOperation = { type: 'enable', status: 'success' }
      return plugin
    })
  }

  async disable(id) {
    return this.#mutate((state) => {
      const plugin = this.#requirePlugin(state, id)
      if (plugin.managedBy !== 'manager') throw new Error(`Plugin ${id} is externally managed`)
      plugin.enabled = false
      plugin.restartRequired = true
      plugin.lastOperation = { type: 'disable', status: 'success' }
      return plugin
    })
  }

  async update(id, { version, commit, artifactBackupId } = {}) {
    return this.#mutate((state) => {
      const plugin = this.#requirePlugin(state, id)
      if (plugin.managedBy !== 'manager') throw new Error(`Plugin ${id} is externally managed`)
      plugin.previousState = {
        version: plugin.version ?? null,
        commit: plugin.commit ?? null,
        enabled: plugin.enabled,
        artifactBackupId: plugin.artifactBackupId ?? null
      }
      if (version !== undefined) plugin.version = version
      if (commit !== undefined) plugin.commit = commit
      if (artifactBackupId !== undefined) plugin.artifactBackupId = artifactBackupId
      plugin.restartRequired = true
      plugin.updatedAt = new Date().toISOString()
      plugin.lastOperation = { type: 'update', status: 'success' }
      return plugin
    })
  }

  async uninstall(id) {
    return this.#mutate((state) => {
      const plugin = this.#requirePlugin(state, id)
      if (plugin.managedBy !== 'manager') throw new Error(`Plugin ${id} is externally managed`)
      delete state.plugins[id]
      return { id, removed: true }
    })
  }

  async rollbackPlugin(id) {
    return this.#mutate((state) => {
      const plugin = this.#requirePlugin(state, id)
      if (!plugin.previousState) throw new Error(`No plugin rollback is available for ${id}`)
      const previous = plugin.previousState
      plugin.version = previous.version
      plugin.commit = previous.commit
      plugin.enabled = previous.enabled
      plugin.artifactBackupId = null
      delete plugin.previousState
      plugin.restartRequired = true
      plugin.lastOperation = { type: 'rollback', status: 'success' }
      return plugin
    })
  }

  async snapshot() {
    return this.#createSnapshot()
  }

  async restoreSnapshot(backupId) {
    const snapshotDir = join(this.backupDir, backupId)
    const manifest = await readJson(join(snapshotDir, 'manifest.json'), null)
    if (!manifest) throw new Error(`Backup ${backupId} is incomplete`)
    await this.#restoreSnapshot(snapshotDir, manifest)
    return this.load()
  }

  async rollback() {
    const state = await this.load()
    if (!state.lastBackupId) throw new Error('No backup is available')

    const snapshotDir = join(this.backupDir, state.lastBackupId)
    const manifest = await readJson(join(snapshotDir, 'manifest.json'), null)
    if (!manifest) throw new Error(`Backup ${state.lastBackupId} is incomplete`)

    await this.#restoreSnapshot(snapshotDir, manifest)
    return this.load()
  }

  async #mutate(mutator) {
    const current = await this.load()
    const currentManifest = await readJson(this.profileManifestPath, null)
    const nextManifest = currentManifest ? structuredClone(currentManifest) : null
    const next = structuredClone(current)
    const result = mutator(next)
    syncProfileManifest(nextManifest, current, next)
    const snapshot = await this.#createSnapshot()
    next.lastBackupId = snapshot.id

    try {
      await this.write(this.statePath, `${JSON.stringify(next, null, 2)}\n`)
      await this.write(this.patchPath, nextManifest ? '[]\n' : renderProfilePatch(next))
      if (nextManifest) await this.write(this.profileManifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`)
    } catch (error) {
      await this.#restoreSnapshot(snapshot.dir, snapshot.manifest)
      throw error
    }

    return result
  }

  async #createSnapshot() {
    await mkdir(this.backupDir, { recursive: true })
    const id = `${Date.now()}-${randomUUID()}`
    const dir = join(this.backupDir, id)
    await mkdir(dir, { recursive: true })
    const manifest = {}

    for (const [name, source] of [
      ['state.json', this.statePath],
      ['patch.yml', this.patchPath],
      ['profile.json', this.profileManifestPath]
    ]) {
      const present = await exists(source)
      manifest[name] = present
      if (present) await copyFile(source, join(dir, name))
    }

    await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    return { id, dir, manifest }
  }

  async #restoreSnapshot(dir, manifest) {
    for (const [name, target] of [
      ['state.json', this.statePath],
      ['patch.yml', this.patchPath],
      ['profile.json', this.profileManifestPath]
    ]) {
      if (manifest[name]) {
        await mkdir(join(target, '..'), { recursive: true })
        await copyFile(join(dir, name), target)
      } else {
        await rm(target, { force: true })
      }
    }
  }

  #assertSupported(plugin) {
    if (!plugin?.id || !plugin?.name) throw new TypeError('Plugin id and name are required')
    if (!SUPPORTED_KINDS.has(plugin.kind)) {
      throw new Error(`Unsupported plugin kind: ${plugin.kind}`)
    }
  }

  #requirePlugin(state, id) {
    const plugin = state.plugins[id]
    if (!plugin) throw new Error(`Plugin ${id} is not installed`)
    return plugin
  }
}

export { SUPPORTED_KINDS }
