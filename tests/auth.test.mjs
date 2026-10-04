import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const api = compile(await readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8')).replace('import.meta.env.VITE_API_BASE_URL', "''").replace(/export /g, '')
const auth = compile(await readFile(new URL('../src/lib/auth.ts', import.meta.url), 'utf8')).replace(/^import .*from '\.\/api';\s*/m, '').replace(/export /g, '')
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
function harness(fetch) {
  const events = []
  const context = { fetch, AbortSignal, Error, Event, window: { dispatchEvent: event => events.push(event.type) }, console }
  vm.runInNewContext(api+'\n'+auth+'\nglobalThis.result = { authAPI, contentAPI };', context)
  return { ...context.result, events }
}

test('auth uses credentialed cookies and CSRF request markers, returning display information only', async () => {
  const calls = []
  const session = { admin: { username: 'fixture.admin', passwordHash: 'must-be-discarded' }, expiresAt: '2026-10-04T23:00:00Z', token: 'must-be-discarded' }
  const { authAPI } = harness(async (url, options) => { calls.push({ url, options }); return json(url.endsWith('logout') ? { message: 'Signed out' } : session) })
  const view = await authAPI.login('fixture.admin', 'temporary input')
  await authAPI.me()
  await authAPI.logout()
  assert.deepEqual(JSON.parse(JSON.stringify(view)), { admin: { username: 'fixture.admin' }, expiresAt: session.expiresAt })
  assert.deepEqual(calls.map(c => c.url), ['/api/auth/login', '/api/auth/me', '/api/auth/logout'])
  for (const { options } of calls) { assert.equal(options.credentials, 'include'); assert.equal(options.cache, 'no-store') }
  assert.equal(calls[0].options.headers['X-Admin-Request'], '1')
  assert.equal(calls[2].options.headers['X-Admin-Request'], '1')
  assert.equal(calls[1].options.headers['X-Admin-Request'], undefined)
})

test('401 on private content invalidates the UI session, while failed login stays on the login screen', async () => {
  const { authAPI, contentAPI, events } = harness(async () => json({ error: 'Authentication required' }, 401))
  await assert.rejects(() => authAPI.login('fixture.admin', 'invalid input'), error => error.status === 401)
  assert.equal(events.length, 0)
  await assert.rejects(() => contentAPI.projects(), error => error.status === 401)
  assert.deepEqual(events, ['portfolio:session-expired'])
})

test('private reads use admin scope and public reads omit cookies', async () => {
  const calls = []
  const { contentAPI } = harness(async (url, options) => { calls.push({ url, options }); return json([]) })
  await contentAPI.projects(); await contentAPI.achievements(); await contentAPI.projects(undefined, true)
  assert.equal(calls[0].url, '/api/projects?scope=admin')
  assert.equal(calls[1].url, '/api/achievements?scope=admin')
  assert.equal(calls[0].options.credentials, 'include')
  assert.equal(calls[2].options.credentials, 'omit')
})

test('malformed session responses and failed logout never report successful authentication', async () => {
  const { authAPI } = harness(async url => url.endsWith('logout') ? json({ error: 'Unable to sign out' }, 500) : json({ admin: { username: 'fixture' }, expiresAt: 'invalid' }))
  await assert.rejects(() => authAPI.me(), /invalid session/)
  await assert.rejects(() => authAPI.logout(), /temporarily unavailable/)
})
