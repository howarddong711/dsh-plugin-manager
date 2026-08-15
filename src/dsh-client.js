import { createElement as h, useEffect, useMemo, useState } from 'react'

import { createManagerClient } from './client.js'

export const inject = ['slots']

const sectionLabel = 'Plugin Manager'

function confirmAction(message) {
  return typeof globalThis.confirm !== 'function' || globalThis.confirm(message)
}

function button(label, onClick, disabled = false, key) {
  return h('button', { key, type: 'button', onClick, disabled }, label)
}

function pluginCard(plugin, installed, busy, onAction) {
  const current = installed?.[plugin.id]
  const actions = []

  if (!current) {
    actions.push(button('Install', () => onAction('install', plugin), busy, 'install'))
  } else {
    actions.push(button(current.enabled ? 'Disable' : 'Enable', () => onAction(current.enabled ? 'disable' : 'enable', plugin), busy, 'toggle'))
    actions.push(button('Update', () => onAction('update', plugin), busy, 'update'))
    if (current.previousState) actions.push(button('Rollback', () => onAction('rollback', plugin), busy, 'rollback'))
    actions.push(button('Uninstall', () => onAction('uninstall', plugin), busy, 'uninstall'))
  }

  return h('article', { key: plugin.id, style: { borderBottom: '1px solid #ddd', padding: '12px 0' } }, [
    h('div', { key: 'heading', style: { display: 'flex', justifyContent: 'space-between', gap: '12px' } }, [
      h('strong', { key: 'name' }, plugin.name ?? plugin.id),
      h('small', { key: 'kind' }, plugin.kind ?? 'unknown')
    ]),
    plugin.description ? h('p', { key: 'description' }, plugin.description) : null,
    h('small', { key: 'meta' }, current
      ? `${current.enabled ? 'Enabled' : 'Disabled'} · ${current.version ?? 'version unknown'}`
      : `${plugin.version ?? 'version unknown'} · ${plugin.repository ?? plugin.id}`),
    h('div', { key: 'actions', style: { display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' } }, actions)
  ])
}

function ManagerSection() {
  const api = useMemo(() => createManagerClient(), [])
  const [tab, setTab] = useState('discover')
  const [query, setQuery] = useState('')
  const [plugins, setPlugins] = useState([])
  const [installed, setInstalled] = useState([])
  const [operations, setOperations] = useState([])
  const [profile, setProfile] = useState('web')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const installedById = useMemo(() => new Map(installed.map((plugin) => [plugin.id, plugin])), [installed])

  async function refresh() {
    const [discovered, installedResult, status] = await Promise.all([
      api.list(query),
      api.installed(),
      api.status()
    ])
    setPlugins(discovered.plugins ?? [])
    setInstalled(installedResult.plugins ?? [])
    setProfile(status.profile ?? 'web')
  }

  useEffect(() => {
    let active = true
    setError('')
    void refresh().catch((cause) => {
      if (active) setError(cause.message)
    })
    return () => { active = false }
  }, [query])

  async function runAction(action, plugin) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (action === 'install') {
        const { plan } = await api.plan(plugin.id)
        const warning = plan.preflight.warnings.length > 0
          ? `\nWarnings: ${plan.preflight.warnings.join('; ')}`
          : ''
        if (!confirmAction(`Install ${plugin.name}?\n\n${plan.actions.join('\n')}${warning}`)) return
      } else if (action === 'uninstall' && !confirmAction(`Uninstall ${plugin.name}?`)) {
        return
      }
      await api.action(action, plugin.id)
      await refresh()
      setTab('installed')
    } catch (cause) {
      setError(cause.message)
    } finally {
      setBusy(false)
    }
  }

  const rows = tab === 'logs'
    ? [h('pre', { key: 'logs', style: { whiteSpace: 'pre-wrap' } }, JSON.stringify(operations, null, 2))]
    : (tab === 'installed' ? installed : plugins).map((plugin) => pluginCard(
      plugin,
      installedById.get(plugin.id),
      busy,
      runAction
    ))

  useEffect(() => {
    if (tab !== 'logs') return undefined
    let active = true
    void api.operations().then((result) => {
      if (active) setOperations(result.operations ?? [])
    }).catch((cause) => {
      if (active) setError(cause.message)
    })
    return () => { active = false }
  }, [tab])

  return h('div', { style: { display: 'grid', gap: '12px' } }, [
    h('div', { key: 'header', style: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' } }, [
      h('div', { key: 'title' }, [h('strong', { key: 'name' }, sectionLabel), h('small', { key: 'profile', style: { display: 'block' } }, `Profile: ${profile}`)]),
      button('Refresh', () => {
        void api.refresh().then(refresh).catch((cause) => setError(cause.message))
      }, busy, 'refresh')
    ]),
    h('nav', { key: 'tabs', style: { display: 'flex', gap: '8px' } }, [
      button('Discover', () => setTab('discover'), busy, 'discover'),
      button('Installed', () => setTab('installed'), busy, 'installed'),
      button('Logs', () => setTab('logs'), busy, 'logs')
    ]),
    tab !== 'logs' ? h('input', {
      key: 'search',
      value: query,
      placeholder: 'Search plugins',
      onChange: (event) => setQuery(event.target.value)
    }) : null,
    error ? h('p', { key: 'error', role: 'alert', style: { color: '#b42318' } }, error) : null,
    h('div', { key: 'list' }, rows.length > 0 ? rows : h('p', { key: 'empty' }, 'No plugins found.'))
  ])
}

export function apply(ctx) {
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-plugin-manager',
    order: 80,
    label: sectionLabel
  }, ManagerSection))
}

export { ManagerSection }
