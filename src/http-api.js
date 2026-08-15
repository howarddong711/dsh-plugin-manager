export const MANAGER_API_PREFIX = '/api/dsh-plugin-manager'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  })
}

async function readBody(request) {
  if (typeof request.json === 'function') return request.json()
  if (!request.body) return {}
  return JSON.parse(request.body)
}

function actionMethod(action) {
  return {
    install: 'install',
    enable: 'enable',
    disable: 'disable',
    update: 'update',
    rollback: 'rollback',
    uninstall: 'uninstall'
  }[action]
}

function routePath(basePath, suffix = '') {
  return `${basePath}${suffix}`
}

export function createManagerApi({ manager, basePath = MANAGER_API_PREFIX, refresh } = {}) {
  if (!manager) throw new TypeError('manager is required')

  return async function handle(request) {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')
      const path = url.pathname

      if (request.method === 'GET' && path === routePath(basePath, '/plugins')) {
        return json({ plugins: manager.discover({ query: url.searchParams.get('query') ?? '', kind: url.searchParams.get('kind') ?? undefined }) })
      }

      if (request.method === 'GET' && path === routePath(basePath, '/installed')) {
        return json({ plugins: await manager.profileManager.list() })
      }

      if (request.method === 'GET' && path === routePath(basePath, '/operations')) {
        return json({ operations: await manager.operationLog.list({ limit: Number(url.searchParams.get('limit') ?? 100) }) })
      }

      if (request.method === 'GET' && path === routePath(basePath, '/status')) {
        return json({ profile: manager.profileManager.profile })
      }

      if (request.method === 'GET' && path === routePath(basePath, '/plan')) {
        const id = url.searchParams.get('id')
        if (!id) return json({ error: 'id is required' }, 400)
        return json({ plan: await manager.planInstall(id) })
      }

      if (request.method === 'POST' && path === routePath(basePath, '/refresh')) {
        if (typeof refresh !== 'function') return json({ error: 'Registry refresh is unavailable' }, 503)
        const registry = await refresh()
        return json({ ok: true, count: registry.entries.length })
      }

      if (request.method === 'POST' && path === routePath(basePath, '/action')) {
        const body = await readBody(request)
        const method = actionMethod(body.action)
        if (!method || typeof body.id !== 'string') return json({ error: 'action and id are required' }, 400)
        const result = await manager[method](body.id, body.options ?? {})
        return json({ ok: true, action: body.action, result })
      }

      return json({ error: 'Not found' }, 404)
    } catch (error) {
      return json({ error: error.message }, 500)
    }
  }
}

function readIncomingBody(request, maxBodyBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    request.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBodyBytes) {
        reject(new Error(`Request body exceeds ${maxBodyBytes} bytes`))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.once('end', () => resolve(Buffer.concat(chunks)))
    request.once('aborted', () => reject(new Error('Request was aborted')))
    request.once('error', reject)
  })
}

function incomingHeaders(headers) {
  const result = new Headers()
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    result.set(name, Array.isArray(value) ? value.join(', ') : String(value))
  }
  return result
}

async function toFetchRequest(request, { maxBodyBytes }) {
  const method = request.method ?? 'GET'
  const host = request.headers.host ?? '127.0.0.1'
  const url = new URL(request.url ?? '/', `http://${host}`)
  const body = method === 'GET' || method === 'HEAD'
    ? undefined
    : await readIncomingBody(request, maxBodyBytes)

  return new Request(url, {
    method,
    headers: incomingHeaders(request.headers),
    body,
    ...(body === undefined ? {} : { duplex: 'half' })
  })
}

async function writeNodeResponse(response, target) {
  const headers = Object.fromEntries(response.headers.entries())
  const body = Buffer.from(await response.arrayBuffer())
  target.writeHead(response.status, headers)
  target.end(body)
}

/**
 * Adapt the fetch-shaped API to DSH's node:http webServer service.
 * Keeping this adapter outside createManagerApi makes the core API easy to
 * test with Request/Response while the runtime uses the official DSH route
 * registration contract.
 */
export function createNodeManagerRoute({ manager, basePath = MANAGER_API_PREFIX, registryReady, refresh, refreshRegistry, maxBodyBytes = 1024 * 1024 } = {}) {
  if (!manager) throw new TypeError('manager is required')
  const handle = createManagerApi({ manager, basePath, refresh: refresh ?? refreshRegistry })
  const ready = Promise.resolve(registryReady)

  return async function handleNodeRequest(request, response) {
    try {
      await ready
      const fetchRequest = await toFetchRequest(request, { maxBodyBytes })
      await writeNodeResponse(await handle(fetchRequest), response)
    } catch (error) {
      if (response.headersSent) {
        response.destroy(error)
        return
      }
      const message = error instanceof Error ? error.message : String(error)
      response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ error: message }))
    }
  }
}
