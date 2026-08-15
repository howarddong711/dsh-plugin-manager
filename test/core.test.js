import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, request as httpRequest } from 'node:http'
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DshPluginManager,
  ArtifactInstaller,
  createManagerApi,
  OperationLog,
  PluginRegistry,
  ProfileManager,
  preflightPlugin,
  renderProfilePatch
} from '../src/index.js'
import { apply as applyDshPlugin } from '../src/dsh-plugin.js'
import { loadRuntimeRegistry } from '../src/dsh-plugin.js'

async function temporaryRoot() {
  return mkdtemp(join(tmpdir(), 'dsh-plugin-manager-'))
}

const plugin = {
  id: 'example/sidebar',
  name: 'Example Sidebar',
  repository: 'example/sidebar',
  packageName: '@example/sidebar',
  kind: 'web-client',
  version: '1.0.0'
}

test('registry searches normalized plugin metadata', () => {
  const registry = new PluginRegistry([
    { full_name: 'example/sidebar', description: 'A file sidebar', type: 'web-client' },
    { id: 'example/memory', description: 'Persistent memory', kind: 'cordis-bundle' }
  ])

  assert.equal(registry.search({ query: 'sidebar' })[0].id, 'example/sidebar')
  assert.equal(registry.search({ kind: 'cordis-bundle' })[0].id, 'example/memory')
})

test('registry accepts the community marketplace repos format', async () => {
  const rootDir = await temporaryRoot()
  const registryPath = join(rootDir, 'registry.json')
  await writeFile(registryPath, JSON.stringify({ repos: [{
    full_name: 'example/web-ui',
    description: 'A web plugin',
    category: 'web-ui',
    pkg_name: '@example/web-ui',
    stargazers_count: 7
  }] }))

  const registry = await PluginRegistry.fromFile(registryPath)
  assert.equal(registry.entries[0].kind, 'web-client')
  assert.equal(registry.entries[0].packageName, '@example/web-ui')
  assert.equal(registry.entries[0].stars, 7)
})

test('missing runtime registry can be disabled without a network request', async () => {
  const rootDir = await temporaryRoot()
  const profileManager = new ProfileManager({ rootDir })
  const manager = new DshPluginManager({
    registry: new PluginRegistry([plugin]),
    profileManager
  })

  await loadRuntimeRegistry(manager, join(rootDir, 'missing.json'), { warn() {} }, { registryUrl: false })
  assert.equal(manager.registry.entries[0].id, plugin.id)
})

test('runtime registry refresh downloads and caches marketplace data', async () => {
  const rootDir = await temporaryRoot()
  const profileManager = new ProfileManager({ rootDir })
  const manager = new DshPluginManager({ registry: new PluginRegistry([]), profileManager })
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ repos: [{
    full_name: 'example/remote',
    category: 'tool'
  }] }), { status: 200 })

  try {
    const registry = await loadRuntimeRegistry(
      manager,
      join(rootDir, 'cache', 'registry.json'),
      { warn() {} },
      { registryUrl: 'https://registry.example.test/index.json', force: true }
    )
    assert.equal(registry.entries[0].id, 'example/remote')
    assert.match(await readFile(join(rootDir, 'cache', 'registry.json'), 'utf8'), /example\/remote/)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('profile manager installs, enables, disables, and uninstalls per profile', async () => {
  const rootDir = await temporaryRoot()
  const manager = new ProfileManager({ rootDir, profile: 'web' })

  await manager.install(plugin)
  assert.equal((await manager.list())[0].enabled, false)

  await manager.enable(plugin.id)
  const enabledPatch = await readFile(join(rootDir, 'profiles', 'web', 'dsh-plugin-manager.patch.yml'), 'utf8')
  assert.match(enabledPatch, /@example\/sidebar/)
  assert.match(enabledPatch, /example\/sidebar/)

  await manager.disable(plugin.id)
  assert.equal(await readFile(join(rootDir, 'profiles', 'web', 'dsh-plugin-manager.patch.yml'), 'utf8'), '[]\n')

  await manager.uninstall(plugin.id)
  assert.deepEqual(await manager.list(), [])
})

test('profile manager syncs a real DSH profile manifest while preserving unrelated bundles', async () => {
  const rootDir = await temporaryRoot()
  const profileDir = join(rootDir, 'profiles', 'web')
  await mkdir(profileDir, { recursive: true })
  await writeFile(join(profileDir, 'package.json'), JSON.stringify({
    name: 'dsh-profile-web',
    dependencies: { '@other/plugin': 'github:other/plugin' },
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@other/plugin'] } }
  }))

  const manager = new ProfileManager({ rootDir, profile: 'web' })
  await manager.install(plugin)
  let profile = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'))
  assert.equal(profile.dependencies['@example/sidebar'], 'github:example/sidebar')
  assert.deepEqual(profile.dsh.profile.bundles, ['@deepseek-ai/dsh-base', '@other/plugin'])

  await manager.enable(plugin.id)
  profile = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'))
  assert.deepEqual(profile.dsh.profile.bundles, ['@deepseek-ai/dsh-base', '@other/plugin', '@example/sidebar'])
  assert.equal(await readFile(join(profileDir, 'dsh-plugin-manager.patch.yml'), 'utf8'), '[]\n')

  await manager.disable(plugin.id)
  profile = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'))
  assert.deepEqual(profile.dsh.profile.bundles, ['@deepseek-ai/dsh-base', '@other/plugin'])

  await manager.uninstall(plugin.id)
  profile = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'))
  assert.equal(profile.dependencies['@example/sidebar'], undefined)
  assert.deepEqual(profile.dsh.profile.bundles, ['@deepseek-ai/dsh-base', '@other/plugin'])
})

test('profile patch is deterministic and only contains enabled supported plugins', () => {
  const patch = renderProfilePatch({
    plugins: {
      'z/plugin': { id: 'z/plugin', name: 'Z', packageName: 'z-pkg', kind: 'web-client', enabled: true },
      'a/plugin': { id: 'a/plugin', name: 'A', packageName: 'a-pkg', kind: 'cordis-bundle', enabled: false },
      'x/skill': { id: 'x/skill', name: 'Skill', kind: 'skill', enabled: true }
    }
  })

  assert.equal(patch, '- insert:\n  - id: "dsh-plugin-manager/z/plugin"\n    name: "z-pkg"\n')
})

test('failed commit restores the previous state and patch', async () => {
  const rootDir = await temporaryRoot()
  let writes = 0
  const manager = new ProfileManager({
    rootDir,
    write: async (filePath, content) => {
      writes += 1
      if (writes === 2) throw new Error('simulated patch write failure')
      const { writeFileAtomic } = await import('../src/profile-manager.js')
      return writeFileAtomic(filePath, content)
    }
  })

  await assert.rejects(() => manager.install(plugin), /simulated patch write failure/)
  assert.deepEqual(await manager.list(), [])
})

test('compatibility preflight reports unsupported DSH versions and permissions', () => {
  const result = preflightPlugin({
    plugin: {
      id: 'example/plugin',
      name: 'Example',
      kind: 'web-client',
      compatibility: { dsh: '>=0.2.0', platforms: ['linux'] },
      permissions: ['network']
    },
    dshVersion: '0.1.0',
    platform: 'win32'
  })

  assert.equal(result.ok, false)
  assert.equal(result.issues.length, 2)
  assert.deepEqual(result.warnings, ['Requires permissions: network'])
})

test('manager creates an install plan and writes an operation log', async () => {
  const rootDir = await temporaryRoot()
  const registry = new PluginRegistry([plugin])
  const profileManager = new ProfileManager({ rootDir, profile: 'web' })
  const operationLog = new OperationLog(join(rootDir, 'logs', 'operations.jsonl'))
  const manager = new DshPluginManager({
    registry,
    profileManager,
    operationLog,
    dshVersion: '0.1.0',
    platform: 'win32'
  })

  const plan = await manager.planInstall(plugin.id)
  assert.equal(plan.preflight.ok, true)
  assert.match(plan.actions.join('\n'), /enable in profile web/)

  await manager.install(plugin.id)
  await manager.enable(plugin.id)
  const events = await operationLog.list()
  assert.deepEqual(events.map((event) => event.type), ['install', 'enable'])
})

test('artifact installer deploys a local package without executing scripts', async () => {
  const rootDir = await temporaryRoot()
  const sourceDir = await temporaryRoot()
  const profileDir = join(rootDir, 'profiles', 'web')
  await mkdir(sourceDir, { recursive: true })
  await writeFile(join(sourceDir, 'package.json'), JSON.stringify({
    name: '@example/sidebar',
    version: '1.2.0',
    scripts: { build: 'node should-not-run.js' }
  }))
  await writeFile(join(sourceDir, 'index.js'), 'export const ok = true\n')

  let runnerCalls = 0
  const installer = new ArtifactInstaller({
    rootDir,
    runner: async () => { runnerCalls += 1 }
  })
  const result = await installer.install({
    id: 'example/sidebar',
    repository: 'example/sidebar',
    packageName: '@example/sidebar',
    source: 'local',
    localPath: sourceDir
  }, { profileDir })

  assert.equal(result.version, '1.2.0')
  assert.equal(runnerCalls, 0)
  assert.equal((await readFile(join(profileDir, 'node_modules', '@example', 'sidebar', 'index.js'), 'utf8')).trim(), 'export const ok = true')
})

test('artifact installer replaces a package and restores the previous version', async () => {
  const rootDir = await temporaryRoot()
  const sourceV1 = await temporaryRoot()
  const sourceV2 = await temporaryRoot()
  const profileDir = join(rootDir, 'profiles', 'web')
  const target = join(profileDir, 'node_modules', '@example', 'sidebar')

  for (const [source, version, marker] of [[sourceV1, '1.0.0', 'old'], [sourceV2, '2.0.0', 'new']]) {
    await writeFile(join(source, 'package.json'), JSON.stringify({ name: '@example/sidebar', version }))
    await writeFile(join(source, 'index.js'), marker)
  }

  const installer = new ArtifactInstaller({ rootDir, runner: async () => {} })
  await installer.install({ id: 'example/sidebar', packageName: '@example/sidebar', source: 'local', localPath: sourceV1 }, { profileDir })
  const update = await installer.install({ id: 'example/sidebar', packageName: '@example/sidebar', source: 'local', localPath: sourceV2 }, { profileDir })
  assert.equal((await readFile(join(target, 'index.js'), 'utf8')).trim(), 'new')

  await installer.rollback(update.backupId)
  assert.equal((await readFile(join(target, 'index.js'), 'utf8')).trim(), 'old')
})

test('failed package validation restores the previous package', async () => {
  const rootDir = await temporaryRoot()
  const sourceV1 = await temporaryRoot()
  const sourceV2 = await temporaryRoot()
  const profileDir = join(rootDir, 'profiles', 'web')
  const target = join(profileDir, 'node_modules', '@example', 'sidebar')

  await writeFile(join(sourceV1, 'package.json'), JSON.stringify({ name: '@example/sidebar', version: '1.0.0' }))
  await writeFile(join(sourceV1, 'index.js'), 'old')
  await writeFile(join(sourceV2, 'package.json'), JSON.stringify({
    name: '@example/sidebar',
    version: '2.0.0',
    scripts: { build: 'node build.js' }
  }))
  await writeFile(join(sourceV2, 'index.js'), 'new')

  let buildAttempted = false
  const installer = new ArtifactInstaller({
    rootDir,
    runner: async (command, args) => {
      if (command === 'npm' && args.includes('run')) {
        buildAttempted = true
        throw new Error('simulated build failure')
      }
    }
  })

  await installer.install({ id: 'example/sidebar', packageName: '@example/sidebar', source: 'local', localPath: sourceV1 }, { profileDir })
  await assert.rejects(
    () => installer.install({ id: 'example/sidebar', packageName: '@example/sidebar', source: 'local', localPath: sourceV2 }, { profileDir, allowScripts: true }),
    /simulated build failure/
  )
  assert.equal(buildAttempted, true)
  assert.equal((await readFile(join(target, 'index.js'), 'utf8')).trim(), 'old')
})

test('manager update records an artifact backup and rollback restores metadata and files', async () => {
  const rootDir = await temporaryRoot()
  const sourceV1 = await temporaryRoot()
  const sourceV2 = await temporaryRoot()
  const profileDir = join(rootDir, 'profiles', 'web')
  const registry = new PluginRegistry([{ ...plugin, source: 'local', localPath: sourceV1, version: '1.0.0' }])
  const profileManager = new ProfileManager({ rootDir, profile: 'web' })
  const installer = new ArtifactInstaller({ rootDir, runner: async () => {} })
  const manager = new DshPluginManager({ registry, profileManager, installer, dshVersion: '0.1.0', platform: 'win32' })

  await writeFile(join(sourceV1, 'package.json'), JSON.stringify({ name: '@example/sidebar', version: '1.0.0' }))
  await writeFile(join(sourceV1, 'index.js'), 'old')
  await writeFile(join(sourceV2, 'package.json'), JSON.stringify({ name: '@example/sidebar', version: '2.0.0' }))
  await writeFile(join(sourceV2, 'index.js'), 'new')

  await manager.install('example/sidebar', { allowScripts: false })
  registry.entries[0].localPath = sourceV2
  registry.entries[0].version = '2.0.0'
  await manager.update('example/sidebar')
  assert.equal((await profileManager.list())[0].version, '2.0.0')
  assert.equal((await readFile(join(profileDir, 'node_modules', '@example', 'sidebar', 'index.js'), 'utf8')).trim(), 'new')

  await manager.rollback('example/sidebar')
  assert.equal((await profileManager.list())[0].version, '1.0.0')
  assert.equal((await readFile(join(profileDir, 'node_modules', '@example', 'sidebar', 'index.js'), 'utf8')).trim(), 'old')
})

test('HTTP API exposes discovery, installed state, operations, and actions', async () => {
  const rootDir = await temporaryRoot()
  const registry = new PluginRegistry([plugin])
  const profileManager = new ProfileManager({ rootDir, profile: 'web' })
  const operationLog = new OperationLog(join(rootDir, 'logs', 'operations.jsonl'))
  const manager = new DshPluginManager({ registry, profileManager, operationLog, dshVersion: '0.1.0', platform: 'win32' })
  const handle = createManagerApi({ manager })

  const listResponse = await handle(new Request('http://localhost/api/dsh-plugin-manager/plugins?query=sidebar'))
  assert.equal(listResponse.status, 200)
  assert.equal((await listResponse.json()).plugins[0].id, plugin.id)

  const actionResponse = await handle(new Request('http://localhost/api/dsh-plugin-manager/action', {
    method: 'POST',
    body: JSON.stringify({ action: 'install', id: plugin.id })
  }))
  assert.equal(actionResponse.status, 200)

  const installedResponse = await handle(new Request('http://localhost/api/dsh-plugin-manager/installed'))
  assert.equal((await installedResponse.json()).plugins[0].id, plugin.id)
})

test('DSH plugin registers a node prefix route and serves the discovery API', async () => {
  const rootDir = await temporaryRoot()
  const routes = []
  let disposeEffect
  const context = {
    logger: { info() {}, warn() {} },
    webServer: {
      register(route) {
        routes.push(route)
        return () => {}
      }
    },
    effect(effect) {
      disposeEffect = effect()
    }
  }

  applyDshPlugin(context, { rootDir, registry: [plugin], registryUrl: false, profile: 'web' })
  assert.equal(routes[0].kind, 'prefix')
  assert.equal(routes[0].path, '/api/dsh-plugin-manager')

  const server = createServer(routes[0].handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const body = await new Promise((resolve, reject) => {
    const request = httpRequest({
      host: '127.0.0.1',
      port,
      path: '/api/dsh-plugin-manager/plugins?query=sidebar',
      method: 'GET'
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
    })
    request.on('error', reject)
    request.end()
  })

  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  await disposeEffect?.()
  assert.equal(body.status, 200)
  assert.equal(JSON.parse(body.body).plugins[0].id, plugin.id)
})
