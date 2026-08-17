import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { execFile as nodeExecFile, spawn as nodeSpawn } from 'node:child_process'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'

const execFile = promisify(nodeExecFile)

async function defaultRunner(command, args, options = {}) {
  if (typeof options.onLog !== 'function') {
    return execFile(command, args, {
      ...options,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024
    })
  }

  return new Promise((resolvePromise, reject) => {
    const child = nodeSpawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      shell: false
    })
    const buffers = { stdout: '', stderr: '' }
    const output = { stdout: '', stderr: '' }

    const consume = (stream, chunk, flush = false) => {
      buffers[stream] += chunk.toString()
      const parts = buffers[stream].split(/\r?\n/)
      buffers[stream] = flush ? '' : (parts.pop() ?? '')
      for (const line of parts) {
        if (!line) continue
        output[stream] += `${line}\n`
        options.onLog(line, stream)
      }
    }

    child.stdout?.on('data', (chunk) => consume('stdout', chunk))
    child.stderr?.on('data', (chunk) => consume('stderr', chunk))
    child.once('error', reject)
    child.once('close', (code, signal) => {
      consume('stdout', '', true)
      consume('stderr', '', true)
      if (code === 0) {
        resolvePromise(output)
        return
      }
      const error = new Error(`${command} exited with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}`)
      error.code = code ?? signal
      error.stdout = output.stdout
      error.stderr = output.stderr
      reject(error)
    })
  })
}

function safePackageName(packageName) {
  if (!packageName || !/^(?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/i.test(packageName)) {
    throw new Error(`Unsafe package name: ${packageName ?? '(missing)'}`)
  }
  return packageName
}

async function readManifest(directory) {
  try {
    return JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

async function pathExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

async function findPackageRoot(directory, expectedName, depth = 0) {
  const manifest = await readManifest(directory)
  if (manifest && (!expectedName || manifest.name === expectedName)) {
    return { directory, manifest }
  }
  if (depth >= 3) return null

  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return null
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '.git' || entry.name === 'node_modules') continue
    const result = await findPackageRoot(join(directory, entry.name), expectedName, depth + 1)
    if (result) return result
  }
  return null
}

export class ArtifactInstaller {
  constructor({ rootDir, runner = defaultRunner } = {}) {
    if (!rootDir) throw new TypeError('rootDir is required')
    this.rootDir = rootDir
    this.runner = runner
    this.stagingDir = join(rootDir, 'staging')
  }

  async stage(plugin, { onLog } = {}) {
    await mkdir(this.stagingDir, { recursive: true })
    const stageDir = join(this.stagingDir, `${plugin.id.replace(/[^a-z0-9_.-]+/gi, '_')}-${randomUUID()}`)
    await mkdir(stageDir, { recursive: true })

    try {
      if (plugin.localPath) {
        await cp(resolve(plugin.localPath), stageDir, { recursive: true })
      } else if (plugin.source === 'npm') {
        await this.#stageNpm(plugin, stageDir, { onLog })
      } else {
        await this.#stageGit(plugin, stageDir, { onLog })
      }

      const packageRoot = await findPackageRoot(stageDir, plugin.packageName)
      if (!packageRoot) throw new Error(`No package.json found for ${plugin.id}`)
      return { ...packageRoot, stageDir }
    } catch (error) {
      await rm(stageDir, { recursive: true, force: true })
      throw error
    }
  }

  async install(plugin, { profileDir, allowScripts = false, onLog } = {}) {
    if (!profileDir) throw new TypeError('profileDir is required')
    let artifact
    let snapshot
    let packageName
    let target
    let temporaryTarget

    try {
      artifact = await this.stage(plugin, { onLog })
      packageName = safePackageName(artifact.manifest.name ?? plugin.packageName)
      target = join(profileDir, 'node_modules', packageName)
      snapshot = await this.#createPackageSnapshot(target, packageName)
      temporaryTarget = join(profileDir, 'node_modules', `.${packageName.replace(/[^a-z0-9_.-]+/gi, '_')}-${randomUUID()}.staging`)
      await rm(temporaryTarget, { recursive: true, force: true })
      await mkdir(join(temporaryTarget, '..'), { recursive: true })
      await cp(artifact.directory, temporaryTarget, { recursive: true })

      if (artifact.manifest.dependencies && Object.keys(artifact.manifest.dependencies).length > 0) {
        await this.runner('npm', [
          'install',
          '--ignore-scripts',
          '--omit=dev',
          '--no-audit',
          '--no-fund'
        ], { cwd: temporaryTarget, onLog })
      }

      if (allowScripts && artifact.manifest.scripts?.build) {
        await this.runner('npm', ['run', 'build'], { cwd: temporaryTarget, onLog })
      }

      await rm(target, { recursive: true, force: true })
      await mkdir(join(target, '..'), { recursive: true })
      await rename(temporaryTarget, target)
    } catch (error) {
      if (temporaryTarget) await rm(temporaryTarget, { recursive: true, force: true })
      if (snapshot?.id) await this.rollback(snapshot.id)
      throw error
    } finally {
      if (artifact?.stageDir) await rm(artifact.stageDir, { recursive: true, force: true })
    }

    return {
      directory: target,
      packageName,
      version: artifact.manifest.version ?? null,
      manifest: artifact.manifest,
      stageDir: artifact.stageDir,
      backupId: snapshot.id
    }
  }

  async uninstall(plugin, { profileDir } = {}) {
    const packageName = safePackageName(plugin.packageName)
    const target = join(profileDir, 'node_modules', packageName)
    const snapshot = await this.#createPackageSnapshot(target, packageName)
    await rm(target, { recursive: true, force: true })
    return { packageName, directory: target, backupId: snapshot.id }
  }

  async rollback(backupId) {
    if (!backupId) throw new TypeError('backupId is required')
    const snapshotDir = join(this.rootDir, 'backups', 'packages', backupId)
    const manifest = JSON.parse(await readFile(join(snapshotDir, 'manifest.json'), 'utf8'))
    await rm(manifest.target, { recursive: true, force: true })
    if (manifest.present) {
      await mkdir(join(manifest.target, '..'), { recursive: true })
      await cp(join(snapshotDir, 'package'), manifest.target, { recursive: true })
    }
    return { backupId, target: manifest.target, restored: manifest.present }
  }

  async #stageGit(plugin, stageDir, { onLog } = {}) {
    const repository = plugin.repository?.startsWith('http')
      ? plugin.repository
      : `https://github.com/${plugin.repository ?? plugin.id}.git`
    await this.runner('git', ['clone', '--depth', '1', repository, stageDir], { cwd: this.rootDir, onLog })
    if (plugin.commit) {
      await this.runner('git', ['-C', stageDir, 'fetch', '--depth', '1', 'origin', plugin.commit], { cwd: this.rootDir, onLog })
      await this.runner('git', ['-C', stageDir, 'checkout', plugin.commit], { cwd: this.rootDir, onLog })
    }
  }

  async #stageNpm(plugin, stageDir, { onLog } = {}) {
    const packageName = safePackageName(plugin.packageName)
    await this.runner('npm', ['pack', packageName, '--pack-destination', stageDir], { cwd: this.rootDir, onLog })
    const entries = await readdir(stageDir)
    const archive = entries.find((entry) => entry.endsWith('.tgz'))
    if (!archive) throw new Error(`npm pack did not produce an archive for ${packageName}`)
    const unpackDir = join(stageDir, 'unpacked')
    await mkdir(unpackDir, { recursive: true })
    await this.runner('npm', ['install', '--ignore-scripts', '--prefix', unpackDir, join(stageDir, archive)], { cwd: this.rootDir, onLog })
    await cp(join(unpackDir, 'node_modules', packageName), join(stageDir, 'package'), { recursive: true })
  }

  async #createPackageSnapshot(target, packageName) {
    const backupId = `${Date.now()}-${randomUUID()}`
    const snapshotDir = join(this.rootDir, 'backups', 'packages', backupId)
    const present = await pathExists(target)
    await mkdir(snapshotDir, { recursive: true })
    if (present) await cp(target, join(snapshotDir, 'package'), { recursive: true })
    await writeFile(join(snapshotDir, 'manifest.json'), `${JSON.stringify({ target, packageName, present }, null, 2)}\n`)
    return { id: backupId, target, packageName, present }
  }
}

export { defaultRunner, findPackageRoot, pathExists, safePackageName }
