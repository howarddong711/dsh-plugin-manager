const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)/

function parseVersion(value) {
  const match = String(value ?? '').match(VERSION_PATTERN)
  if (!match) return null
  return match.slice(1).map(Number)
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}

function satisfies(version, range) {
  if (!range) return true
  const current = parseVersion(version)
  if (!current) return false

  return String(range)
    .split('||')
    .some((alternative) => alternative.trim().split(/\s+/).filter(Boolean).every((rule) => {
      const normalized = rule.trim()
      const operator = normalized.match(/^(\^|~|>=|<=|>|<|=)?\s*(\d+\.\d+\.\d+)/)
      if (!operator) return false
      const target = parseVersion(operator[2])
      const comparison = compareVersions(current, target)

      switch (operator[1] ?? '=') {
        case '^': return current[0] === target[0] && comparison >= 0
        case '~': return current[0] === target[0] && current[1] === target[1] && comparison >= 0
        case '>=': return comparison >= 0
        case '<=': return comparison <= 0
        case '>': return comparison > 0
        case '<': return comparison < 0
        default: return comparison === 0
      }
    }))
}

export function preflightPlugin({ plugin, dshVersion, platform = process.platform } = {}) {
  const issues = []
  const warnings = []

  if (!plugin?.id || !plugin?.name) issues.push('Plugin metadata is missing id or name')
  if (!plugin?.kind) issues.push('Plugin metadata is missing kind')

  const supportedKinds = new Set(['cordis-bundle', 'web-client'])
  if (plugin?.kind && !supportedKinds.has(plugin.kind)) {
    issues.push(`MVP does not yet support plugin kind: ${plugin.kind}`)
  }

  const dshRange = plugin?.compatibility?.dsh
  if (dshRange && (!dshVersion || !satisfies(dshVersion, dshRange))) {
    issues.push(`DSH ${dshVersion ?? 'unknown'} does not satisfy ${dshRange}`)
  }

  const platforms = plugin?.compatibility?.platforms ?? []
  if (platforms.length > 0 && !platforms.includes(platform)) {
    issues.push(`Platform ${platform} is not supported`)
  }

  if ((plugin?.permissions ?? []).length > 0) {
    warnings.push(`Requires permissions: ${plugin.permissions.join(', ')}`)
  }
  if (plugin?.installScript || plugin?.requiresBuild) {
    warnings.push('Installation may execute third-party build or install steps')
  }

  return { ok: issues.length === 0, issues, warnings }
}

export { compareVersions, parseVersion, satisfies }
