import { createElement as h, useEffect, useMemo, useState } from 'react'

import { createManagerClient } from './client.js'
import { en, zh } from './locales.js'

export const inject = ['slots', 'locale']

const LOCALE_NAMESPACE = 'dsh-plugin-manager'
const MARKETPLACE_MODE = 'marketplace'
const MANAGER_MODE = 'manager'

function confirmAction(message) {
  return typeof globalThis.confirm !== 'function' || globalThis.confirm(message)
}

function button(label, onClick, disabled = false, key, extra = {}) {
  const style = {
    border: '1px solid var(--dsw-alias-border-l2, #d9d9d9)',
    background: 'var(--dsw-alias-bg-base, #fff)',
    color: 'var(--dsw-alias-label-primary, inherit)',
    borderRadius: '8px',
    padding: '6px 10px',
    cursor: disabled ? 'default' : 'pointer',
    ...extra.style
  }
  return h('button', {
    key,
    type: 'button',
    onClick,
    disabled,
    ...extra,
    style
  }, label)
}

function kindLabel(kind, t) {
  if (kind === 'web-client') return t('kindWebClient')
  if (kind === 'cordis-bundle') return t('kindCordisBundle')
  return t('kindUnknown')
}

function matchesQuery(plugin, query) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return [plugin.id, plugin.name, plugin.description, plugin.repository, plugin.homepage, plugin.kind]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalized)
}

function githubUrl(plugin) {
  for (const value of [plugin.homepage, plugin.repository]) {
    if (typeof value !== 'string' || !value.trim()) continue
    const normalized = value.trim().replace(/^github:/i, '')
    const candidate = /^https?:\/\//i.test(normalized)
      ? normalized
      : `https://github.com/${normalized}`
    try {
      const url = new URL(candidate)
      if (url.hostname.toLowerCase() !== 'github.com') continue
      const path = url.pathname.replace(/\.git$/, '').replace(/\/$/, '')
      if (!/^\/[^/]+\/[^/]+/.test(path)) continue
      return `https://github.com${path}`
    } catch {
      continue
    }
  }
  return null
}

function starCount(plugin) {
  if (plugin.stars === null || plugin.stars === undefined || plugin.stars === '') return null
  const count = Number(plugin.stars)
  return Number.isFinite(count) ? count : null
}

function formatStars(plugin) {
  const count = starCount(plugin)
  return count === null ? null : new Intl.NumberFormat().format(count)
}

function compareByStars(left, right) {
  const leftStars = starCount(left)
  const rightStars = starCount(right)
  if (leftStars === null && rightStars !== null) return 1
  if (leftStars !== null && rightStars === null) return -1
  if (leftStars !== rightStars) return (rightStars ?? -1) - (leftStars ?? -1)
  return String(left.name ?? left.id).localeCompare(String(right.name ?? right.id))
}

function pluginCard({ plugin, current, mode, busy, onAction, t }) {
  const actions = []
  const name = plugin.name ?? plugin.id
  const repositoryUrl = githubUrl(plugin)
  const stars = formatStars(plugin)

  if (mode === MARKETPLACE_MODE) {
    actions.push(current
      ? h('span', {
        key: 'installed',
        style: {
          color: 'var(--dsw-alias-state-success-primary, #16a34a)',
          padding: '6px 0'
        }
      }, current.enabled ? t('installed') : `${t('installed')} · ${t('disabled')}`)
      : button(t('install'), () => onAction('install', plugin), busy, 'install'))
  } else {
    actions.push(button(
      current.enabled ? t('disable') : t('enable'),
      () => onAction(current.enabled ? 'disable' : 'enable', plugin),
      busy,
      'toggle'
    ))
    actions.push(button(t('update'), () => onAction('update', plugin), busy, 'update'))
    if (current.previousState) {
      actions.push(button(t('rollback'), () => onAction('rollback', plugin), busy, 'rollback'))
    }
    actions.push(button(t('uninstall'), () => onAction('uninstall', plugin), busy, 'uninstall'))
  }

  const metadata = current
    ? `${current.enabled ? t('enabled') : t('disabled')} · ${current.version ?? t('versionUnknown')}`
    : `${plugin.version ?? t('versionUnknown')} · ${plugin.repository ?? plugin.id}`

  return h('article', {
    key: plugin.id,
    style: {
      border: '1px solid var(--dsw-alias-border-l2, #e1e1e1)',
      borderRadius: '12px',
      padding: '14px',
      display: 'grid',
      gap: '8px',
      minWidth: 0,
      background: 'var(--dsw-alias-bg-base, #fff)'
    }
  }, [
    h('div', {
      key: 'heading',
      style: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline' }
    }, [
      h('strong', { key: 'name', style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, name),
      h('small', { key: 'kind', style: { flexShrink: 0 } }, kindLabel(plugin.kind, t))
    ]),
    plugin.description ? h('p', { key: 'description', style: { margin: 0, lineHeight: 1.5 } }, plugin.description) : null,
    h('div', {
      key: 'meta',
      style: {
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'center',
        color: 'var(--dsw-alias-label-secondary, #777)'
      }
    }, [
      repositoryUrl
        ? h('a', {
          key: 'github',
          href: repositoryUrl,
          target: '_blank',
          rel: 'noreferrer',
          style: { color: 'var(--dsw-alias-label-link, #2563eb)' }
        }, t('github'))
        : h('span', { key: 'repository' }, plugin.repository ?? plugin.id),
      h('span', { key: 'stars' }, stars === null ? t('starsUnknown') : t('stars', { count: stars }))
    ]),
    h('div', {
      key: 'actions',
      role: 'group',
      'aria-label': t('ariaPluginActions'),
      style: { display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }
    }, actions)
  ])
}

function ManagerPanel({ mode, t }) {
  const api = useMemo(() => createManagerClient(), [])
  const [view, setView] = useState(mode === MARKETPLACE_MODE ? 'marketplace' : 'installed')
  const [query, setQuery] = useState('')
  const [plugins, setPlugins] = useState([])
  const [installed, setInstalled] = useState([])
  const [operations, setOperations] = useState([])
  const [profile, setProfile] = useState('web')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const installedById = useMemo(() => new Map(installed.map((plugin) => [plugin.id, plugin])), [installed])

  async function load() {
    const status = await api.status()
    setProfile(status.profile ?? 'web')

    if (mode === MARKETPLACE_MODE) {
      const [discovered, installedResult] = await Promise.all([api.list(query), api.installed()])
      setPlugins(discovered.plugins ?? [])
      setInstalled(installedResult.plugins ?? [])
    } else if (view === 'logs') {
      const result = await api.operations()
      setOperations(result.operations ?? [])
    } else {
      const result = await api.installed()
      setInstalled(result.plugins ?? [])
    }
  }

  useEffect(() => {
    let active = true
    setError('')
    void load().catch((cause) => {
      if (active) setError(`${t('errorPrefix')}: ${cause.message}`)
    })
    return () => { active = false }
  }, [mode, query, view])

  async function runAction(action, plugin) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (action === 'install') {
        const { plan } = await api.plan(plugin.id)
        const warning = plan.preflight.warnings.length > 0
          ? `\n\n${t('warnings')}: ${plan.preflight.warnings.join('; ')}`
          : ''
        const details = plan.actions.length > 0 ? `\n\n${plan.actions.join('\n')}` : ''
        if (!confirmAction(`${t('confirmInstall', { name: plugin.name ?? plugin.id })}${details}${warning}`)) return
      } else if (action === 'uninstall' && !confirmAction(t('confirmUninstall', { name: plugin.name ?? plugin.id }))) {
        return
      }
      await api.action(action, plugin.id)
      await load()
    } catch (cause) {
      setError(`${t('errorPrefix')}: ${cause.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function refreshMarketplace() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await api.refresh()
      await load()
    } catch (cause) {
      setError(`${t('errorPrefix')}: ${cause.message}`)
    } finally {
      setBusy(false)
    }
  }

  const source = mode === MARKETPLACE_MODE ? plugins : installed
  const visible = source
    .filter((plugin) => matchesQuery(plugin, query))
    .sort(mode === MARKETPLACE_MODE ? compareByStars : () => 0)
  const rows = mode === MANAGER_MODE && view === 'logs'
    ? [h('pre', {
      key: 'logs',
      style: {
        whiteSpace: 'pre-wrap',
        margin: 0,
        padding: '12px',
        borderRadius: '8px',
        background: 'var(--dsw-alias-bg-secondary, #f7f7f7)',
        overflow: 'auto'
      }
    }, JSON.stringify(operations, null, 2))]
    : visible.map((plugin) => pluginCard({
      plugin,
      current: installedById.get(plugin.id),
      mode,
      busy,
      onAction: runAction,
      t
    }))

  return h('div', { style: { display: 'grid', gap: '14px' } }, [
    h('div', {
      key: 'header',
      style: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }
    }, [
      h('div', { key: 'title' }, [
        h('strong', { key: 'name', style: { display: 'block', fontSize: '16px' } }, t(mode === MARKETPLACE_MODE ? 'marketplaceTitle' : 'managerTitle')),
        h('small', { key: 'intro', style: { display: 'block', marginTop: '4px' } }, t(mode === MARKETPLACE_MODE ? 'marketplaceIntro' : 'managerIntro')),
        h('small', { key: 'profile', style: { display: 'block', marginTop: '4px' } }, t('profile', { profile }))
      ]),
      button(mode === MARKETPLACE_MODE ? t('refreshMarket') : t('refresh'),
        mode === MARKETPLACE_MODE ? refreshMarketplace : () => { void load().catch((cause) => setError(`${t('errorPrefix')}: ${cause.message}`)) },
        busy,
        'refresh')
    ]),
    mode === MANAGER_MODE ? h('nav', {
      key: 'views',
      role: 'tablist',
      'aria-label': t('ariaViews'),
      style: { display: 'flex', gap: '8px' }
    }, [
      button(t('installedView'), () => setView('installed'), busy, 'installed-view', {
        role: 'tab',
        'aria-selected': view === 'installed'
      }),
      button(t('logsView'), () => setView('logs'), busy, 'logs-view', {
        role: 'tab',
        'aria-selected': view === 'logs'
      })
    ]) : null,
    h('input', {
      key: 'search',
      value: query,
      placeholder: t(mode === MARKETPLACE_MODE ? 'searchMarketplace' : 'searchInstalled'),
      'aria-label': t(mode === MARKETPLACE_MODE ? 'searchMarketplace' : 'searchInstalled'),
      onChange: (event) => setQuery(event.target.value),
      style: {
        width: '100%',
        boxSizing: 'border-box',
        border: '1px solid var(--dsw-alias-border-l2, #d9d9d9)',
        borderRadius: '10px',
        padding: '10px 12px',
        background: 'var(--dsw-alias-bg-base, #fff)',
        color: 'var(--dsw-alias-label-primary, inherit)'
      }
    }),
    error ? h('p', { key: 'error', role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary, #b42318)', margin: 0 } }, error) : null,
    h('div', {
      key: 'list',
      style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }
    }, rows.length > 0
      ? rows
      : h('p', { key: 'empty' }, mode === MANAGER_MODE ? t('noInstalled') : t('noResults')))
  ])
}

export function apply(ctx) {
  ctx.effect(
    () => ctx.locale.register(LOCALE_NAMESPACE, { zh, en }),
    'dsh-plugin-manager: locale dictionaries'
  )

  const t = ctx.locale.bind(LOCALE_NAMESPACE)
  ctx.slots.inject('settings.plugins.tab', function* () {
    yield ctx.slots.register({
      name: 'settings.plugins.tab',
      id: 'dsh-plugin-manager',
      order: 20,
      label: () => t('managerTab'),
      locale: LOCALE_NAMESPACE
    }, (props) => h(ManagerPanel, { ...props, mode: MANAGER_MODE }))
    yield ctx.slots.register({
      name: 'settings.plugins.tab',
      id: 'dsh-plugin-marketplace',
      order: 30,
      label: () => t('marketplaceTab'),
      locale: LOCALE_NAMESPACE
    }, (props) => h(ManagerPanel, { ...props, mode: MARKETPLACE_MODE }))
  })
}
