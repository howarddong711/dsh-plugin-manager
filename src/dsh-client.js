import { createElement as h, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { createManagerClient } from './client.js'
import { en, zh } from './locales.js'

export const inject = ['slots', 'locale']

const LOCALE_NAMESPACE = 'dsh-plugin-manager'
const PAGE_MODE = {
  market: 'market',
  installed: 'installed',
  activity: 'activity'
}

const colors = {
  ink: 'var(--dsw-alias-label-primary, #172033)',
  muted: 'var(--dsw-alias-label-secondary, #667085)',
  border: 'var(--dsw-alias-border-l2, #e5e7eb)',
  surface: 'var(--dsw-alias-bg-base, #ffffff)',
  soft: 'var(--dsw-alias-bg-secondary, #f7f8fb)',
  accent: 'var(--dsw-alias-brand-primary, #4f46e5)',
  success: 'var(--dsw-alias-state-success-primary, #15803d)',
  warning: 'var(--dsw-alias-state-warning-primary, #b45309)',
  error: 'var(--dsw-alias-state-error-primary, #b42318)'
}

function confirmAction(message) {
  return typeof globalThis.confirm !== 'function' || globalThis.confirm(message)
}

function formatStars(plugin) {
  const count = Number(plugin?.stars)
  return Number.isFinite(count) && count >= 0 ? new Intl.NumberFormat().format(count) : null
}

function githubUrl(plugin) {
  for (const value of [plugin?.homepage, plugin?.repository]) {
    if (typeof value !== 'string' || !value.trim()) continue
    const normalized = value.trim().replace(/^github:/i, '')
    const candidate = /^https?:\/\//i.test(normalized) ? normalized : `https://github.com/${normalized}`
    try {
      const url = new URL(candidate)
      if (url.hostname.toLowerCase() !== 'github.com') continue
      const path = url.pathname.replace(/\.git$/, '').replace(/\/$/, '')
      if (/^\/[^/]+\/[^/]+/.test(path)) return `https://github.com${path}`
    } catch {
      // Ignore malformed registry links and keep rendering the card.
    }
  }
  return null
}

function ownerOf(plugin) {
  const repo = String(plugin?.repository ?? plugin?.id ?? '')
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^github:/i, '')
  return repo.split('/')[0] || 'DSH'
}

function avatarColor(value) {
  let hash = 0
  for (const char of String(value)) hash = ((hash << 5) - hash) + char.charCodeAt(0)
  const palette = ['#4f46e5', '#0f766e', '#c2410c', '#7c3aed', '#0369a1', '#be123c']
  return palette[Math.abs(hash) % palette.length]
}

function kindLabel(kind, t) {
  if (kind === 'web-client') return t('kindWebClient')
  if (kind === 'cordis-bundle') return t('kindCordisBundle')
  if (kind === 'skill') return t('kindSkill')
  if (kind === 'preset') return t('kindPreset')
  return t('kindUnknown')
}

function installable(plugin) {
  return plugin?.kind === 'web-client' || plugin?.kind === 'cordis-bundle'
}

function matchesQuery(plugin, query) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return [plugin.id, plugin.name, plugin.description, plugin.repository, plugin.homepage, plugin.kind]
    .filter(Boolean).join(' ').toLowerCase().includes(normalized)
}

function sortPlugins(plugins, sort) {
  return [...plugins].sort((left, right) => {
    if (sort === 'name') return String(left.name ?? left.id).localeCompare(String(right.name ?? right.id))
    if (sort === 'version') return String(right.version ?? '').localeCompare(String(left.version ?? ''), undefined, { numeric: true })
    return Number(right.stars ?? -1) - Number(left.stars ?? -1) || String(left.name ?? left.id).localeCompare(String(right.name ?? right.id))
  })
}

function statusTone(status) {
  if (status === 'completed' || status === 'enabled' || status === 'active') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'queued' || status === 'running' || status === 'disabled') return 'warning'
  return 'neutral'
}

function Badge({ children, tone = 'neutral' }) {
  const toneColors = {
    success: { color: colors.success, background: 'rgba(22, 163, 74, .10)' },
    warning: { color: colors.warning, background: 'rgba(217, 119, 6, .12)' },
    error: { color: colors.error, background: 'rgba(220, 38, 38, .10)' },
    neutral: { color: colors.muted, background: colors.soft }
  }
  return h('span', {
    style: {
      display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '999px',
      padding: '4px 8px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
      ...toneColors[tone]
    }
  }, [h('span', { key: 'dot', style: { width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' } }), children])
}

function ActionButton({ children, onClick, disabled = false, primary = false, danger = false, title }) {
  return h('button', {
    type: 'button', onClick, disabled, title,
    style: {
      border: primary ? '1px solid transparent' : `1px solid ${colors.border}`,
      background: primary ? colors.accent : colors.surface,
      color: primary ? '#fff' : danger ? colors.error : colors.ink,
      borderRadius: '9px', padding: '8px 12px', fontSize: '12px', fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .55 : 1,
      transition: 'transform .15s ease, box-shadow .15s ease',
      boxShadow: primary && !disabled ? '0 5px 12px rgba(79,70,229,.20)' : 'none'
    }
  }, children)
}

function Avatar({ plugin }) {
  const owner = ownerOf(plugin)
  return h('div', {
    'aria-hidden': 'true',
    style: {
      width: '42px', height: '42px', flexShrink: 0, display: 'grid', placeItems: 'center',
      borderRadius: '12px', color: '#fff', background: avatarColor(owner), fontSize: '17px', fontWeight: 800,
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.25)'
    }
  }, owner.slice(0, 1).toUpperCase())
}

function stageLabel(stage, t) {
  return t(`stage_${stage}`) || stage
}

function operationProgress(operation) {
  if (Number.isFinite(Number(operation?.progress))) return Math.max(0, Math.min(100, Number(operation.progress)))
  if (operation?.status === 'completed') return 100
  return {
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
    failed: 100
  }[operation?.stage] ?? 0
}

function ProgressBar({ operation, t }) {
  const percent = operationProgress(operation)
  const tone = operation.status === 'failed' ? colors.error : operation.status === 'completed' ? colors.success : colors.accent
  return h('div', { key: 'progress', style: { display: 'grid', gap: '6px' } }, [
    h('div', { key: 'labels', style: { display: 'flex', justifyContent: 'space-between', gap: '8px', color: colors.muted, fontSize: '11px' } }, [
      h('span', { key: 'stage' }, operation.status === 'failed' ? t('status_failed') : stageLabel(operation.stage, t)),
      h('span', { key: 'percent', style: { fontVariantNumeric: 'tabular-nums' } }, `${percent}%`)
    ]),
    h('div', { key: 'track', role: 'progressbar', 'aria-label': t('operationProgress'), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent, style: { height: '6px', borderRadius: '999px', overflow: 'hidden', background: 'rgba(148,163,184,.24)' } },
      h('div', { style: { width: `${percent}%`, height: '100%', borderRadius: 'inherit', background: tone, transition: 'width .25s ease' } }))
  ])
}

function OperationRow({ operation, t, onClick, selected }) {
  const statusKey = operation.status === 'completed' ? 'completed' : operation.status
  return h('button', {
    type: 'button', onClick, 'aria-pressed': selected,
    style: {
      display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', width: '100%', textAlign: 'left',
      border: selected ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
      background: selected ? 'rgba(79,70,229,.06)' : colors.surface, borderRadius: '12px', padding: '12px', cursor: 'pointer'
    }
  }, [
    h('span', { key: 'main', style: { minWidth: 0 } }, [
      h('strong', { key: 'title', style: { display: 'block', color: colors.ink, fontSize: '13px' } }, `${t(`action_${operation.action}`)} · ${operation.pluginId}`),
      h('small', { key: 'stage', style: { display: 'block', color: colors.muted, marginTop: '4px' } }, operation.status === 'failed' ? operation.error : stageLabel(operation.stage, t))
    ]),
    h(Badge, { key: 'status', tone: statusTone(operation.status) }, t(`status_${statusKey}`))
  ])
}

function LogPanel({ operation, t }) {
  const logRef = useRef(null)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [operation?.operationId, operation?.logs?.length])

  if (!operation) {
    return h('div', { style: { border: `1px dashed ${colors.border}`, borderRadius: '14px', padding: '32px', color: colors.muted, textAlign: 'center' } }, t('selectOperation'))
  }
  return h('div', { style: { border: `1px solid ${colors.border}`, borderRadius: '14px', overflow: 'hidden', background: '#101522' } }, [
    h('div', { key: 'bar', style: { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', background: '#182033', color: '#dbe4ff' } }, [
      h('strong', { key: 'title', style: { fontSize: '13px' } }, `${t(`action_${operation.action}`)} · ${operation.pluginId}`),
      h(Badge, { key: 'status', tone: statusTone(operation.status) }, t(`status_${operation.status === 'completed' ? 'completed' : operation.status}`))
    ]),
    h('div', { key: 'progress', style: { padding: '11px 14px 0', background: '#101522' } }, h(ProgressBar, { operation, t })),
    h('pre', { key: 'logs', ref: logRef, 'aria-live': 'polite', style: { margin: 0, padding: '14px', minHeight: '170px', maxHeight: '380px', overflow: 'auto', color: '#d7e0f4', fontSize: '12px', lineHeight: 1.7, whiteSpace: 'pre-wrap' } }, operation.logs?.length
      ? operation.logs.map((entry) => `[${entry.timestamp?.slice(11, 19) ?? '--:--:--'}] ${entry.line}`).join('\n')
      : t('noLogs'))
  ])
}

function DetailField({ label, value }) {
  return h('div', { style: { minWidth: 0, padding: '10px 11px', borderRadius: '10px', background: colors.soft } }, [
    h('small', { key: 'label', style: { display: 'block', color: colors.muted, fontSize: '10px', fontWeight: 700 } }, label),
    h('div', { key: 'value', style: { marginTop: '4px', color: colors.ink, fontSize: '12px', lineHeight: 1.45, overflowWrap: 'anywhere' } }, value)
  ])
}

function DetailList({ title, values, empty }) {
  return h('section', { style: { display: 'grid', gap: '7px' } }, [
    h('strong', { key: 'title', style: { color: colors.ink, fontSize: '12px' } }, title),
    values?.length
      ? h('div', { key: 'values', style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, values.map((value) => h(Badge, { key: value, tone: 'neutral' }, value)))
      : h('small', { key: 'empty', style: { color: colors.muted } }, empty)
  ])
}

function PluginDetails({ plugin, current, operation, t, onClose, onAction }) {
  const repositoryUrl = githubUrl(plugin)
  const canInstall = installable(plugin)
  const isBusy = operation && (operation.status === 'queued' || operation.status === 'running')
  const enabled = current?.enabled === true
  const primaryAction = current ? (enabled ? 'disable' : 'enable') : 'install'
  return h('div', { role: 'presentation', onClick: onClose, style: { position: 'fixed', inset: 0, zIndex: 20, display: 'flex', justifyContent: 'flex-end', background: 'rgba(15,23,42,.36)', backdropFilter: 'blur(2px)' } },
    h('aside', { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('detailTitle'), onClick: (event) => event.stopPropagation(), style: { width: 'min(520px, 100%)', height: '100%', overflow: 'auto', boxSizing: 'border-box', padding: '22px', background: colors.surface, boxShadow: '-18px 0 45px rgba(15,23,42,.18)' } }, [
      h('div', { key: 'top', style: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '20px' } }, [
        h('strong', { key: 'title', style: { color: colors.ink, fontSize: '16px' } }, t('detailTitle')),
        h(ActionButton, { key: 'close', onClick: onClose, title: t('close') }, t('close'))
      ]),
      h('div', { key: 'identity', style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } }, [
        h(Avatar, { key: 'avatar', plugin }),
        h('div', { key: 'name', style: { minWidth: 0, flex: 1 } }, [
          h('h2', { key: 'heading', style: { margin: 0, color: colors.ink, fontSize: '22px', letterSpacing: '-.035em', overflowWrap: 'anywhere' } }, plugin.name ?? plugin.id),
          h('div', { key: 'owner', style: { marginTop: '5px', color: colors.muted, fontSize: '12px' } }, ownerOf(plugin)),
          h('div', { key: 'badges', style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '9px' } }, [
            h(Badge, { key: 'kind', tone: 'neutral' }, kindLabel(plugin.kind, t)),
            current ? h(Badge, { key: 'installed', tone: enabled ? 'success' : 'warning' }, enabled ? t('enabled') : t('disabled')) : null,
            current?.restartRequired ? h(Badge, { key: 'restart', tone: 'warning' }, t('needsReload')) : null
          ])
        ])
      ]),
      h('p', { key: 'description', style: { margin: '20px 0', color: colors.muted, fontSize: '13px', lineHeight: 1.75, whiteSpace: 'pre-wrap' } }, plugin.description || t('noDescription')),
      h('div', { key: 'fields', style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginBottom: '18px' } }, [
        h(DetailField, { key: 'stars', label: t('starsLabel'), value: formatStars(plugin) === null ? t('starsUnknown') : t('stars', { count: formatStars(plugin) }) }),
        h(DetailField, { key: 'version', label: t('versionLabel'), value: current?.version ?? plugin.version ?? t('versionUnknown') }),
        h(DetailField, { key: 'source', label: t('sourceLabel'), value: plugin.source === 'npm' ? t('sourceNpm') : t('sourceGithub') }),
        h(DetailField, { key: 'package', label: t('packageLabel'), value: plugin.packageName ?? t('notProvided') }),
        h(DetailField, { key: 'branch', label: t('branchLabel'), value: plugin.defaultBranch ?? t('notProvided') }),
        h(DetailField, { key: 'build', label: t('buildLabel'), value: plugin.requiresBuild ? t('yes') : t('no') })
      ]),
      h('div', { key: 'lists', style: { display: 'grid', gap: '16px', marginBottom: '20px' } }, [
        h(DetailList, { key: 'permissions', title: t('permissionsLabel'), values: plugin.permissions, empty: t('none') }),
        h(DetailList, { key: 'requires', title: t('requirementsLabel'), values: plugin.requires, empty: t('none') })
      ]),
      repositoryUrl ? h('a', { key: 'github', href: repositoryUrl, target: '_blank', rel: 'noreferrer', style: { display: 'block', marginBottom: '16px', color: colors.accent, fontSize: '12px', fontWeight: 700, overflowWrap: 'anywhere' } }, `${t('github')}: ${repositoryUrl}`) : null,
      h('div', { key: 'actions', style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
        canInstall || current ? h(ActionButton, { key: 'primary', primary: !enabled, disabled: isBusy || (!current && !canInstall), onClick: () => onAction(primaryAction, plugin) }, current ? (enabled ? t('disable') : t('enable')) : (isBusy ? t('installing') : t('install'))) : h(ActionButton, { key: 'unsupported', disabled: true }, t('unsupported')),
        current ? h(ActionButton, { key: 'update', disabled: isBusy, onClick: () => onAction('update', plugin) }, t('update')) : null
      ]),
      operation ? h('div', { key: 'operation', style: { marginTop: '20px' } }, h(LogPanel, { operation, t })) : null
    ])
  )
}

function PluginCard({ plugin, current, operation, mode, t, onAction, onDetails }) {
  const repositoryUrl = githubUrl(plugin)
  const stars = formatStars(plugin)
  const isBusy = operation && (operation.status === 'queued' || operation.status === 'running')
  const isInstalled = Boolean(current)
  const enabled = current?.enabled === true
  const canInstall = installable(plugin)
  const primaryAction = mode === PAGE_MODE.market
    ? (isInstalled ? t('installed') : t('install'))
    : (enabled ? t('disable') : t('enable'))

  const actions = mode === PAGE_MODE.market
    ? [
      isInstalled
        ? h(ActionButton, { key: 'installed', disabled: true }, primaryAction)
        : h(ActionButton, { key: 'install', primary: canInstall, disabled: isBusy || !canInstall, onClick: () => onAction('install', plugin) }, !canInstall ? t('unsupported') : isBusy ? t('installing') : primaryAction),
      isInstalled ? h(ActionButton, { key: 'update', disabled: isBusy, onClick: () => onAction('update', plugin) }, t('update')) : null
    ]
    : [
      h(ActionButton, { key: 'toggle', primary: !enabled, disabled: isBusy, onClick: () => onAction(enabled ? 'disable' : 'enable', plugin) }, primaryAction),
      h(ActionButton, { key: 'update', disabled: isBusy, onClick: () => onAction('update', plugin) }, t('update')),
      h(ActionButton, { key: 'uninstall', danger: true, disabled: isBusy, onClick: () => onAction('uninstall', plugin) }, t('uninstall'))
    ]

  return h('article', {
    style: {
      display: 'grid', gap: '14px', minWidth: 0, padding: '16px', borderRadius: '16px',
      border: `1px solid ${colors.border}`, background: colors.surface, boxShadow: '0 8px 24px rgba(16,24,40,.05)'
    }
  }, [
    h('div', { key: 'header', style: { display: 'flex', gap: '11px', alignItems: 'flex-start' } }, [
      h(Avatar, { key: 'avatar', plugin }),
      h('div', { key: 'name', style: { minWidth: 0, flex: 1 } }, [
        h('strong', { key: 'title', style: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colors.ink, fontSize: '14px' } }, plugin.name ?? plugin.id),
        h('small', { key: 'owner', style: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colors.muted, marginTop: '4px' } }, ownerOf(plugin))
      ]),
      h(Badge, { key: 'kind', tone: 'neutral' }, kindLabel(plugin.kind, t))
    ]),
    plugin.description ? h('p', { key: 'description', style: { margin: 0, minHeight: '42px', color: colors.muted, fontSize: '12px', lineHeight: 1.65, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } }, plugin.description) : h('p', { key: 'description-empty', style: { margin: 0, minHeight: '42px', color: colors.muted, fontSize: '12px' } }, t('noDescription')),
    h('div', { key: 'meta', style: { display: 'flex', gap: '9px', flexWrap: 'wrap', alignItems: 'center', color: colors.muted, fontSize: '11px' } }, [
      repositoryUrl ? h('a', { key: 'github', href: repositoryUrl, target: '_blank', rel: 'noreferrer', style: { color: colors.accent, fontWeight: 700 } }, 'GitHub') : null,
      h('span', { key: 'stars' }, stars === null ? t('starsUnknown') : t('stars', { count: stars })),
      h('span', { key: 'version' }, current?.version ?? plugin.version ?? t('versionUnknown')),
      current ? h(Badge, { key: 'installed-state', tone: enabled ? 'success' : 'warning' }, enabled ? t('enabled') : t('disabled')) : null,
      current?.restartRequired ? h(Badge, { key: 'reload-state', tone: 'warning' }, t('needsReload')) : null,
      isBusy ? h(Badge, { key: 'operation-state', tone: 'warning' }, operation.status === 'queued' ? t('status_queued') : stageLabel(operation.stage, t)) : null
    ]),
    h('div', { key: 'actions', style: { display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '2px' } }, [
      h(ActionButton, { key: 'details', onClick: () => onDetails(plugin) }, t('details')),
      ...actions
    ])
  ])
}

function Stat({ label, value, accent }) {
  return h('div', { style: { border: `1px solid ${colors.border}`, borderRadius: '14px', padding: '12px 14px', background: colors.surface } }, [
    h('strong', { key: 'value', style: { display: 'block', color: accent ?? colors.ink, fontSize: '22px', letterSpacing: '-.04em' } }, String(value)),
    h('small', { key: 'label', style: { display: 'block', color: colors.muted, marginTop: '3px', fontSize: '11px' } }, label)
  ])
}

function ManagerPage({ t, locale }) {
  const api = useMemo(() => createManagerClient(), [])
  const subscribe = typeof locale?.subscribe === 'function' ? (callback) => locale.subscribe(callback) : () => () => {}
  const getSnapshot = typeof locale?.getSnapshot === 'function' ? () => locale.getSnapshot() : () => ({ active: 'en' })
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const [mode, setMode] = useState(PAGE_MODE.market)
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [sort, setSort] = useState('stars')
  const [plugins, setPlugins] = useState([])
  const [installed, setInstalled] = useState([])
  const [operations, setOperations] = useState([])
  const [profile, setProfile] = useState('web')
  const [selectedOperationId, setSelectedOperationId] = useState(null)
  const [selectedPluginId, setSelectedPluginId] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true)
    try {
      const [status, installedResult, operationResult] = await Promise.all([
        api.status(), api.installed(), api.operations()
      ])
      setProfile(status.profile ?? 'web')
      setInstalled(installedResult.plugins ?? [])
      setOperations(operationResult.operations ?? [])
      if (mode === PAGE_MODE.market) {
        const market = await api.list(query)
        setPlugins(market.plugins ?? [])
      }
      setError('')
    } catch (cause) {
      setError(`${t('errorPrefix')}: ${cause.message}`)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [api, mode, query, t])

  useEffect(() => { void load({ showLoading: true }) }, [load])

  useEffect(() => {
    const timer = setInterval(() => { void load() }, 900)
    return () => clearInterval(timer)
  }, [load])

  const installedById = useMemo(() => new Map(installed.map((plugin) => [plugin.id, plugin])), [installed])
  const operationByPlugin = useMemo(() => new Map(
    operations.filter((operation) => operation.status === 'queued' || operation.status === 'running').map((operation) => [operation.pluginId, operation])
  ), [operations])
  const selectedOperation = operations.find((operation) => operation.operationId === selectedOperationId) ?? operations[0] ?? null
  const selectedPlugin = [...plugins, ...installed].find((plugin) => plugin.id === selectedPluginId) ?? null
  const visible = sortPlugins((mode === PAGE_MODE.market ? plugins : installed)
    .filter((plugin) => kindFilter === 'all' || plugin.kind === kindFilter)
    .filter((plugin) => matchesQuery(plugin, query)), sort)

  async function refresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      if (mode === PAGE_MODE.market) await api.refresh()
      await load()
    } catch (cause) {
      setError(`${t('errorPrefix')}: ${cause.message}`)
    } finally {
      setRefreshing(false)
    }
  }

  async function runAction(action, plugin) {
    if (operationByPlugin.has(plugin.id)) return
    if (action === 'install') {
      const { plan } = await api.plan(plugin.id)
      const warning = plan.preflight.warnings.length > 0 ? `\n\n${t('warnings')}: ${plan.preflight.warnings.join('; ')}` : ''
      if (!confirmAction(`${t('confirmInstall', { name: plugin.name ?? plugin.id })}${warning}`)) return
    }
    if (action === 'uninstall' && !confirmAction(t('confirmUninstall', { name: plugin.name ?? plugin.id }))) return
    try {
      const response = await api.action(action, plugin.id)
      const operation = response.operation
      if (operation?.operationId) setSelectedOperationId(operation.operationId)
      await load()
    } catch (cause) {
      setError(`${t('errorPrefix')}: ${cause.message}`)
    }
  }

  const title = mode === PAGE_MODE.market ? t('marketTitle') : mode === PAGE_MODE.installed ? t('installedTitle') : t('activityTitle')
  const activeCount = operations.filter((operation) => operation.status === 'queued' || operation.status === 'running').length
  const updateCount = installed.filter((plugin) => plugin.updateAvailable).length

  return h('main', {
    style: {
      maxWidth: '1180px', margin: '0 auto', padding: '24px', color: colors.ink,
      fontFamily: 'inherit', background: colors.soft, borderRadius: '22px', minHeight: '620px'
    }
  }, [
    h('section', { key: 'hero', style: { position: 'relative', overflow: 'hidden', borderRadius: '20px', padding: '24px', color: '#fff', background: 'linear-gradient(135deg, #202a5a 0%, #4f46e5 58%, #7c3aed 100%)', boxShadow: '0 16px 34px rgba(55,48,163,.24)' } }, [
      h('div', { key: 'hero-content', style: { position: 'relative', zIndex: 1, maxWidth: '680px' } }, [
        h('div', { key: 'eyebrow', style: { display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11px', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .78 } }, 'DSH PLUGIN MANAGER'),
        h('h1', { key: 'title', style: { margin: '8px 0 7px', fontSize: '28px', letterSpacing: '-.04em' } }, t('pageTitle')),
        h('p', { key: 'intro', style: { margin: 0, fontSize: '13px', lineHeight: 1.65, opacity: .86 } }, t('pageIntro'))
      ]),
      h('div', { key: 'orb', 'aria-hidden': 'true', style: { position: 'absolute', right: '-48px', top: '-88px', width: '240px', height: '240px', borderRadius: '50%', background: 'rgba(255,255,255,.12)', boxShadow: '0 0 0 36px rgba(255,255,255,.05)' } })
    ]),
    h('div', { key: 'stats', style: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px', margin: '14px 0' } }, [
      h(Stat, { key: 'total', label: t('totalPlugins'), value: plugins.length || '—', accent: colors.accent }),
      h(Stat, { key: 'installed', label: t('installedCount'), value: installed.length, accent: colors.success }),
      h(Stat, { key: 'active', label: t('activeTasks'), value: activeCount, accent: activeCount ? colors.warning : colors.ink }),
      h(Stat, { key: 'updates', label: t('updatesAvailable'), value: updateCount, accent: updateCount ? colors.warning : colors.ink })
    ]),
    h('nav', { key: 'nav', role: 'tablist', 'aria-label': t('pageNavigation'), style: { display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' } }, [
      ...[
        [PAGE_MODE.market, t('marketTab')],
        [PAGE_MODE.installed, t('installedTab')],
        [PAGE_MODE.activity, `${t('activityTab')}${activeCount ? ` (${activeCount})` : ''}`]
      ].map(([value, label]) => h('button', { key: value, type: 'button', role: 'tab', 'aria-selected': mode === value, onClick: () => setMode(value), style: { border: mode === value ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`, background: mode === value ? colors.accent : colors.surface, color: mode === value ? '#fff' : colors.muted, borderRadius: '10px', padding: '9px 14px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' } }, label)),
      h(ActionButton, { key: 'refresh', onClick: refresh, disabled: refreshing }, refreshing ? t('refreshing') : t('refresh'))
    ]),
    h('div', { key: 'section-heading', style: { margin: '0 0 12px' } }, [
      h('h2', { key: 'title', style: { margin: 0, color: colors.ink, fontSize: '18px', letterSpacing: '-.025em' } }, title),
      h('p', { key: 'intro', style: { margin: '4px 0 0', color: colors.muted, fontSize: '12px' } }, mode === PAGE_MODE.market ? t('marketIntro') : mode === PAGE_MODE.installed ? t('installedIntro') : t('activityIntro'))
    ]),
    mode !== PAGE_MODE.activity ? h('div', { key: 'toolbar', style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' } }, [
      h('input', { key: 'search', value: query, placeholder: t('searchPlugins'), 'aria-label': t('searchPlugins'), onChange: (event) => setQuery(event.target.value), style: { flex: 1, minWidth: '220px', boxSizing: 'border-box', border: `1px solid ${colors.border}`, borderRadius: '11px', padding: '11px 13px', background: colors.surface, color: colors.ink, outline: 'none' } }),
      h('select', { key: 'kind', value: kindFilter, 'aria-label': t('kindFilter'), onChange: (event) => setKindFilter(event.target.value), style: { minWidth: '138px', border: `1px solid ${colors.border}`, borderRadius: '11px', padding: '10px 11px', background: colors.surface, color: colors.ink, fontSize: '12px' } }, [
        h('option', { key: 'all', value: 'all' }, t('allKinds')),
        h('option', { key: 'web-client', value: 'web-client' }, t('kindWebClient')),
        h('option', { key: 'cordis-bundle', value: 'cordis-bundle' }, t('kindCordisBundle')),
        h('option', { key: 'skill', value: 'skill' }, t('kindSkill')),
        h('option', { key: 'preset', value: 'preset' }, t('kindPreset'))
      ]),
      h('select', { key: 'sort', value: sort, 'aria-label': t('sortLabel'), onChange: (event) => setSort(event.target.value), style: { minWidth: '138px', border: `1px solid ${colors.border}`, borderRadius: '11px', padding: '10px 11px', background: colors.surface, color: colors.ink, fontSize: '12px' } }, [
        h('option', { key: 'stars', value: 'stars' }, t('sortStars')),
        h('option', { key: 'name', value: 'name' }, t('sortName')),
        h('option', { key: 'version', value: 'version' }, t('sortVersion'))
      ]),
      h('span', { key: 'count', style: { color: colors.muted, fontSize: '12px', whiteSpace: 'nowrap' } }, `${visible.length} ${t('results')}`)
    ]) : null,
    error ? h('div', { key: 'error', role: 'alert', style: { marginBottom: '14px', border: '1px solid rgba(220,38,38,.20)', borderRadius: '12px', padding: '11px 13px', background: 'rgba(220,38,38,.07)', color: colors.error, fontSize: '12px' } }, error) : null,
    mode === PAGE_MODE.activity
      ? h('section', { key: 'activity', style: { display: 'grid', gridTemplateColumns: 'minmax(240px, .85fr) minmax(0, 1.5fr)', gap: '14px' } }, [
        h('div', { key: 'list', style: { display: 'grid', gap: '8px', alignContent: 'start' } }, operations.length > 0 ? operations.map((operation) => h(OperationRow, { key: operation.operationId ?? `${operation.action}-${operation.pluginId}`, operation, t, selected: operation.operationId === selectedOperation?.operationId, onClick: () => setSelectedOperationId(operation.operationId) })) : h('div', { style: { border: `1px dashed ${colors.border}`, borderRadius: '14px', padding: '28px 16px', color: colors.muted, textAlign: 'center' } }, t('noOperations'))),
        h(LogPanel, { key: 'log', operation: selectedOperation, t })
      ])
      : h('section', { key: 'cards' }, loading
        ? h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '12px' } }, [1, 2, 3, 4].map((value) => h('div', { key: value, style: { height: '220px', borderRadius: '16px', background: colors.surface, border: `1px solid ${colors.border}`, opacity: .7 } })))
        : visible.length > 0
          ? h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '12px' } }, visible.map((plugin) => h(PluginCard, { key: plugin.id, plugin, current: installedById.get(plugin.id), operation: operationByPlugin.get(plugin.id), mode, t, onAction: runAction, onDetails: (value) => setSelectedPluginId(value.id) })))
          : h('div', { style: { border: `1px dashed ${colors.border}`, borderRadius: '14px', padding: '44px 16px', color: colors.muted, textAlign: 'center' } }, mode === PAGE_MODE.market ? t('noResults') : t('noInstalled'))),
    mode !== PAGE_MODE.activity && selectedOperation ? h('section', { key: 'live-log', style: { marginTop: '14px' } }, [
      h('div', { key: 'live-heading', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } }, [
        h('strong', { key: 'title', style: { fontSize: '13px' } }, t('latestOperation')),
        h(ActionButton, { key: 'open', onClick: () => setMode(PAGE_MODE.activity) }, t('viewActivity'))
      ]),
      h(LogPanel, { key: 'live-log-panel', operation: selectedOperation, t })
    ]) : null,
    selectedPlugin ? h(PluginDetails, { key: 'details', plugin: selectedPlugin, current: installedById.get(selectedPlugin.id), operation: operationByPlugin.get(selectedPlugin.id), t, onClose: () => setSelectedPluginId(null), onAction: runAction }) : null
  ])
}

export function apply(ctx) {
  ctx.effect(
    () => ctx.locale.register(LOCALE_NAMESPACE, { zh, en }),
    'dsh-plugin-manager: locale dictionaries'
  )

  const t = ctx.locale.bind(LOCALE_NAMESPACE)
  // Independent top-level settings section. The native DSH Plugins page is
  // intentionally untouched; this page owns its own market and lifecycle UI.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-plugin-manager',
    order: 45,
    label: () => t('pageTitle'),
    locale: LOCALE_NAMESPACE
  }, () => h(ManagerPage, { t, locale: ctx.locale })))
}
