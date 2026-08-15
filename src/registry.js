import { readFile } from 'node:fs/promises'

function normalizeEntry(entry) {
  const id = entry.id ?? entry.full_name ?? entry.repository
  if (!id || typeof id !== 'string') throw new TypeError('Registry entries require an id')

  const category = entry.category ?? entry.marketplaceCategory
  const inferredKind = category === 'web-ui'
    ? 'web-client'
    : category === 'skill'
      ? 'skill'
      : category === 'preset'
        ? 'preset'
        : 'cordis-bundle'

  return {
    id,
    name: entry.name ?? id.split('/').at(-1),
    repository: entry.repository ?? entry.full_name ?? id,
    packageName: entry.packageName ?? entry.pkg_name,
    kind: entry.kind ?? entry.type ?? inferredKind,
    description: entry.description ?? '',
    version: entry.version ?? entry.latestVersion,
    category,
    stars: entry.stars ?? entry.stargazers_count ?? 0,
    homepage: entry.homepage ?? entry.html_url,
    defaultBranch: entry.defaultBranch ?? entry.default_branch,
    compatibility: entry.compatibility ?? {},
    permissions: entry.permissions ?? [],
    requires: entry.requires ?? [],
    localPath: entry.localPath,
    commit: entry.commit,
    installScript: entry.installScript,
    requiresBuild: entry.requiresBuild,
    source: entry.source ?? 'registry'
  }
}

function starCountOf(entry) {
  if (entry?.stars === null || entry?.stars === undefined || entry.stars === '') return -1
  const count = Number(entry.stars)
  return Number.isFinite(count) ? count : -1
}

function compareByStars(left, right) {
  const difference = starCountOf(right) - starCountOf(left)
  if (difference !== 0) return difference
  return String(left.name).localeCompare(String(right.name))
}

export class PluginRegistry {
  constructor(entries = []) {
    this.entries = entries.map(normalizeEntry)
  }

  static async fromFile(filePath) {
    const parsed = JSON.parse(await readFile(filePath, 'utf8'))
    const entries = Array.isArray(parsed) ? parsed : parsed.plugins ?? parsed.repos ?? []
    return new PluginRegistry(entries)
  }

  get(id) {
    return this.entries.find((entry) => entry.id === id)
  }

  search({ query = '', kind } = {}) {
    const normalizedQuery = query.trim().toLowerCase()
    return this.entries.filter((entry) => {
      if (kind && entry.kind !== kind) return false
      if (!normalizedQuery) return true

      const haystack = [
        entry.id,
        entry.name,
        entry.repository,
        entry.description,
        ...entry.permissions,
        ...entry.requires
      ].join(' ').toLowerCase()

      return haystack.includes(normalizedQuery)
    }).sort(compareByStars)
  }
}

export { normalizeEntry }
