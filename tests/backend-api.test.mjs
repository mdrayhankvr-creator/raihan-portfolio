import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'

const base = process.env.PORTFOLIO_API_TEST_URL?.replace(/\/$/, '')
test('live authenticated Go + MongoDB CRUD, publication, metadata, and logout', { skip: !base }, async () => {
  // Run explicitly against a development/test API; only created fixture IDs are deleted.
  const created = []
  const label = `Integration fixture ${randomUUID()}`
  let cookie = ''
  const frontendOrigin = process.env.PORTFOLIO_FRONTEND_ORIGIN || 'http://localhost:5173'
  async function call(path, method = 'GET', body, status = 200, origin = frontendOrigin, anonymous = false, marker = true) {
    const response = await fetch(base+path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(origin ? { Origin: origin } : {}), ...(!anonymous && cookie ? { Cookie: cookie } : {}), ...(marker && method !== 'GET' ? { 'X-Admin-Request': '1' } : {}) }, signal: AbortSignal.timeout(12000) })
    assert.equal(response.status, status, `${method} ${path}`)
    assert.match(response.headers.get('content-type'), /^application\/json/)
    if (path === '/auth/login' && response.ok) cookie = response.headers.getSetCookie()[0].split(';')[0]
    return response.json()
  }
  try {
    assert.equal((await call('/health')).database, 'connected')
    assert.ok(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD, 'Set test admin credentials in server-side process environment')
    await call('/auth/me', 'GET', undefined, 401)
    await call('/projects?scope=admin', 'GET', undefined, 401)
    for (const resource of ['projects', 'achievements']) {
      for (const [method, path] of [['POST', '/'+resource], ['PUT', '/'+resource+'/aaaaaaaaaaaaaaaaaaaaaaaa'], ['DELETE', '/'+resource+'/aaaaaaaaaaaaaaaaaaaaaaaa']]) await call(path, method, undefined, 401)
    }
    await call('/auth/login', 'POST', {}, 400)
    await call('/auth/login', 'POST', { username: process.env.ADMIN_USERNAME, password: randomUUID() }, 401)
    const session = await call('/auth/login', 'POST', { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD })
    assert.equal(session.admin.username, process.env.ADMIN_USERNAME)
    assert.deepEqual(Object.keys(session).sort(), ['admin', 'expiresAt'])
    await call('/auth/me')
    await call('/projects', 'POST', {}, 403, frontendOrigin, false, false)
    for (const [resource, input] of [
      ['projects', { title: label, status: 'In Progress', description: 'Temporary API test record', technologies: ['Go'], technologyLabel: 'Proposed stack', published: false }],
      ['achievements', { title: label, event: label, year: 2026, result: 'Finalist', description: '', team: 'Fixture team', division: 'Fixture division', published: false }],
    ]) {
      const record = await call('/'+resource, 'POST', input, 201)
      created.push({ resource, id: record.id })
      assert.match(record.id, /^[a-f0-9]{24}$/)
      assert.equal(Number.isNaN(Date.parse(record.createdAt)), false)
      assert.equal(record.createdAt, record.updatedAt)
      assert.equal((await call('/'+resource+'?scope=admin')).some(item => item.id === record.id), true)
      assert.equal((await call('/'+resource, 'GET', undefined, 200, frontendOrigin, true)).some(item => item.id === record.id), false)
      assert.equal((await call('/'+resource+'?published=true')).some(item => item.id === record.id), false)
      await new Promise(resolve => setTimeout(resolve, 20))
      const updated = await call('/'+resource+'/'+record.id, 'PUT', { ...input, title: label+' updated', published: true, ...(resource === 'achievements' ? { team: '', division: '' } : {}) })
      assert.equal(updated.createdAt, record.createdAt)
      assert.ok(Date.parse(updated.updatedAt) > Date.parse(record.updatedAt))
      assert.equal(updated.published, true)
      assert.equal((await call('/'+resource+'?published=true')).some(item => item.id === record.id), true)
      if (resource === 'projects') assert.equal(updated.technologyLabel, 'Proposed stack')
      else { assert.equal(updated.result, 'Finalist'); assert.equal(updated.team, undefined); assert.equal(updated.division, undefined) }
      await call('/'+resource+'/'+record.id, 'GET', undefined, 405)
      await call('/'+resource+'/'+record.id, 'DELETE')
      await call('/'+resource+'/'+record.id, 'DELETE', undefined, 404)
      await call('/'+resource+'/'+record.id, 'PUT', input, 404)
      await call('/'+resource+'/bad', 'DELETE', undefined, 400)
      await call('/'+resource, 'POST', { ...input, createdAt: 'client-controlled' }, 400)
    }
    await call('/projects', 'POST', { title: label, description: 'Test', status: 'Champion', published: true }, 400)
    await call('/projects', 'PATCH', undefined, 405)
    await call('/missing', 'GET', undefined, 404)
    await call('/projects', 'OPTIONS', undefined, 200, 'http://localhost:5173')
    await call('/projects', 'GET', undefined, 403, 'https://untrusted.example')
    await call('/auth/logout', 'POST')
    // Replaying the old cookie after logout must fail on the server, not just in the UI.
    await call('/auth/me', 'GET', undefined, 401)
    await call('/projects', 'POST', {}, 401)
  } finally {
    for (const { resource, id } of created) await fetch(`${base}/${resource}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Cookie: cookie, Origin: frontendOrigin, 'X-Admin-Request': '1' }, signal: AbortSignal.timeout(12000) })
    if (cookie) await fetch(base+'/auth/logout', { method: 'POST', headers: { Cookie: cookie, Origin: frontendOrigin, 'X-Admin-Request': '1' }, signal: AbortSignal.timeout(12000) })
  }
})
