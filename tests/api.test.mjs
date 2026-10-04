import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
function harness(fetch, base = '') {
  const code = compiled.replace('import.meta.env.VITE_API_BASE_URL', JSON.stringify(base)).replace(/export /g, '') + '\nglobalThis.api = { contentAPI, publicAPIConfigured };'
  const context = { fetch, AbortSignal, Error, console }
  vm.runInNewContext(code, context)
  return context.api
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const project = { id: '012345678901234567890123', title: 'Fixture', category: 'Service', status: 'In Progress', description: 'Fixture only', icon: 'ai', technologies: ['Go or Python', 'React'], technologyLabel: 'Proposed stack', published: false, createdAt: '2026-10-04T00:00:00Z', updatedAt: '2026-10-04T00:00:01Z' }
const achievement = { id: '012345678901234567890124', title: 'Event', event: 'Event', year: 2026, result: 'Finalist', description: '', team: 'Test team', division: 'Test division', published: true, createdAt: project.createdAt, updatedAt: project.updatedAt }

test('project and achievement adapters preserve status, proposed stack, and real metadata', async () => {
  const calls = []
  const { contentAPI, publicAPIConfigured } = harness(async (url, options) => { calls.push({ url, options }); return json(url.includes('projects') ? [project] : [achievement]) }, 'http://localhost:8080/api/')
  assert.equal(publicAPIConfigured, true)
  const [p] = await contentAPI.projects(undefined, true)
  assert.equal(p.isPublished, false)
  assert.equal(p.status, 'In Progress')
  assert.equal(p.stack.label, 'Proposed stack')
  assert.equal(p.createdAt, project.createdAt)
  const [a] = await contentAPI.achievements(undefined, true)
  assert.equal(a.result, 'Finalist')
  assert.equal(a.team, achievement.team)
  assert.equal(a.division, achievement.division)
  assert.equal(calls[0].url, 'http://localhost:8080/api/projects?published=true')
  assert.equal(calls[1].url, 'http://localhost:8080/api/achievements?published=true')
  assert.equal(calls[0].options.credentials, 'omit')
})

test('POST/PUT send editable fields only and wait for returned database records', async () => {
  const calls = []
  const { contentAPI, publicAPIConfigured } = harness(async (url, options) => { calls.push({ url, options }); return json(url.includes('projects') ? project : achievement, options.method === 'POST' ? 201 : 200) })
  assert.equal(publicAPIConfigured, false)
  const draft = { title: project.title, category: project.category, status: project.status, description: project.description, icon: project.icon, stack: { label: project.technologyLabel, technologies: project.technologies }, isPublished: false, createdAt: 'ignored', updatedAt: 'ignored' }
  const saved = await contentAPI.saveProject(draft)
  assert.equal(saved.id, project.id)
  await contentAPI.saveProject(draft, project.id)
  await contentAPI.saveAchievement({ event: 'Event', year: 2026, result: 'Finalist', isPublished: true, team: 'Test team' })
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.credentials, 'include')
  assert.equal(calls[0].options.headers['X-Admin-Request'], '1')
  assert.equal(calls[1].options.method, 'PUT')
  assert.equal(calls[1].url, '/api/projects/'+project.id)
  const body = JSON.parse(calls[0].options.body)
  assert.equal(body.published, false)
  assert.equal(body.technologyLabel, 'Proposed stack')
  for (const field of ['id', 'createdAt', 'updatedAt', 'isPublished']) assert.equal(field in body, false)
  assert.equal(JSON.parse(calls[2].options.body).title, 'Event')
})

test('network, server, non-JSON and malformed JSON errors cannot report success', async () => {
  for (const [fetch, message] of [
    [async () => { throw new TypeError('network failure') }, /Cannot reach/],
    [async () => json({ error: 'Database unavailable' }, 500), /temporarily unavailable/],
    [async () => new Response('<html>Vite shell</html>', { headers: { 'Content-Type': 'text/html' } }), /did not return JSON/],
    [async () => new Response('{', { headers: { 'Content-Type': 'application/json' } }), /invalid JSON/],
  ]) {
    const { contentAPI } = harness(fetch)
    await assert.rejects(() => contentAPI.projects(), message)
    await assert.rejects(() => contentAPI.deleteProject(project.id), message)
  }
})

test('empty collections stay empty and failed deletes propagate', async () => {
  const { contentAPI } = harness(async (_, options) => options.method === 'DELETE' ? json({ error: 'Record not found' }, 404) : json([]))
  assert.equal((await contentAPI.projects()).length, 0)
  assert.equal((await contentAPI.achievements()).length, 0)
  await assert.rejects(() => contentAPI.deleteAchievement(achievement.id), /Record not found/)
})

test('arbitrary backend error messages never reach the UI, while useful status codes are retained', async () => {
  for (const status of [400, 401, 403, 404, 429, 500, 502]) {
    const { contentAPI } = harness(async () => json({ error: 'private-value: MongoDB connection credentials and stack trace' }, status))
    await assert.rejects(() => contentAPI.saveProject({}), error => error.status === status && !error.message.includes('private-value') && !error.message.includes('credentials'))
  }
})
