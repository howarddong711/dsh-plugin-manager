import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

import { ArtifactInstaller } from './artifact-installer.js'
import { DshPluginManager } from './manager.js'
import { createNodeManagerRoute, MANAGER_API_PREFIX } from './http-api.js'
import { PluginRegistry } from './registry.js'
import { ProfileManager } from './profile-manager.js'

export const name = 'dsh-plugin-manager'
export const inject = ['webServer']
export const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/bradeGithub/DSH-Plugins-Marketplace/main/registry.json'

function defaultDshHome() {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

export function createRuntimeManager(config = {}) {
  const dshHome = resolve(config.rootDir ?? config.dshHome ?? defaultDshHome())
  const profile = config.profile ?? process.env.DSH_PROFILE ?? 'web'
  const profileManager = new ProfileManager({ rootDir: dshHome, profile })
  const installer = new ArtifactInstaller({
    rootDir: resolve(config.managerRoot ?? join(dshHome, 'plugin-manager'))
  })
  const registry = new PluginRegistry(Array.isArray(config.registry) ? config.registry : [])

  const manager = new DshPluginManager({
    registry,
    profileManager,
    installer,
    dshVersion: config.dshVersion ?? process.env.DSH_VERSION,
    platform: config.platform ?? process.platform
  })

  return {
    dshHome,
    registryPath: resolve(config.registryPath ?? join(dshHome, 'plugin-manager', 'registry.json')),
    registryUrl: config.registryUrl === false ? null : (config.registryUrl ?? DEFAULT_REGISTRY_URL),
    manager
  }
}

async function fetchRegistry(registryUrl, timeoutMs = 5000) {
  if (typeof fetch !== 'function') throw new Error('Global fetch is unavailable')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(registryUrl, {
      headers: { accept: 'application/json' },
      signal: controller.signal
    })
    if (!response.ok) throw new Error(`Registry request failed: ${response.status}`)
    return response.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function loadRuntimeRegistry(manager, registryPath, logger = console, {
  registryUrl = DEFAULT_REGISTRY_URL,
  timeoutMs = 15000,
  force = false
} = {}) {
  if (!force) {
    try {
      manager.registry = await PluginRegistry.fromFile(registryPath)
      return manager.registry
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        logger.warn?.(`[dsh-plugin-manager] registry load failed: ${error.message}`)
        return manager.registry
      }
    }
  }

  if (registryUrl) {
    try {
      const parsed = await fetchRegistry(registryUrl, timeoutMs)
      manager.registry = new PluginRegistry(Array.isArray(parsed) ? parsed : parsed.plugins ?? parsed.repos ?? [])
      await mkdir(join(registryPath, '..'), { recursive: true })
      await writeFile(registryPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
    } catch (remoteError) {
      logger.warn?.(`[dsh-plugin-manager] remote registry unavailable: ${remoteError.message}`)
    }
  }
  return manager.registry
}

export function apply(ctx, config = {}) {
  const logger = ctx?.logger ?? console
  const runtime = createRuntimeManager(config)
  const registryOptions = {
    registryUrl: runtime.registryUrl,
    timeoutMs: config.registryTimeoutMs ?? 15000
  }
  const registryReady = loadRuntimeRegistry(runtime.manager, runtime.registryPath, logger, registryOptions)
  const refreshRegistry = () => loadRuntimeRegistry(runtime.manager, runtime.registryPath, logger, {
    ...registryOptions,
    force: true
  })
  const handler = createNodeManagerRoute({ manager: runtime.manager, registryReady, refreshRegistry })

  const dispose = ctx.webServer.register({
    kind: 'prefix',
    path: MANAGER_API_PREFIX,
    handler
  })
  if (typeof ctx.effect === 'function') ctx.effect(() => dispose, 'dsh-plugin-manager: web route')

  logger.info?.(`[dsh-plugin-manager] ready for profile ${runtime.manager.profileManager.profile}`)
  return runtime.manager
}
