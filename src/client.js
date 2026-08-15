export function createManagerViewModel({ plugins = [], profile = 'web' } = {}) {
  return {
    title: 'DSH Plugin Manager',
    profile,
    plugins: plugins.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      kind: plugin.kind,
      enabled: Boolean(plugin.enabled),
      version: plugin.version ?? null,
      restartRequired: Boolean(plugin.restartRequired)
    }))
  }
}

export function createManagerClient({ fetchImpl = globalThis.fetch, basePath = '/api/dsh-plugin-manager' } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required')

  const request = async (path, options) => {
    const response = await fetchImpl(`${basePath}${path}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) }
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error ?? `Request failed: ${response.status}`)
    return payload
  }

  return {
    list: (query = '') => request(`/plugins?query=${encodeURIComponent(query)}`),
    installed: () => request('/installed'),
    status: () => request('/status'),
    plan: (id) => request(`/plan?id=${encodeURIComponent(id)}`),
    refresh: () => request('/refresh', { method: 'POST', body: '{}' }),
    operations: () => request('/operations'),
    action: (action, id, options = {}) => request('/action', {
      method: 'POST',
      body: JSON.stringify({ action, id, options })
    })
  }
}

export function renderManagerPage({ document, model, onAction = () => {} } = {}) {
  if (!document) throw new TypeError('document is required')
  const root = document.createElement('section')
  root.className = 'dsh-plugin-manager'
  root.dataset.profile = model.profile

  const heading = document.createElement('h2')
  heading.textContent = 'DSH Plugin Manager'
  root.append(heading)

  const list = document.createElement('div')
  list.className = 'dsh-plugin-manager__list'
  for (const plugin of model.plugins) {
    const card = document.createElement('article')
    card.className = 'dsh-plugin-manager__card'
    card.dataset.pluginId = plugin.id

    const title = document.createElement('strong')
    title.textContent = plugin.name
    card.append(title)

    const status = document.createElement('span')
    status.className = 'dsh-plugin-manager__status'
    status.textContent = plugin.enabled ? 'Enabled' : 'Disabled'
    card.append(status)

    const action = document.createElement('button')
    action.type = 'button'
    action.dataset.action = plugin.enabled ? 'disable' : 'enable'
    action.textContent = plugin.enabled ? 'Disable' : 'Enable'
    action.addEventListener('click', () => onAction(action.dataset.action, plugin.id))
    card.append(action)

    list.append(card)
  }
  root.append(list)
  return root
}
