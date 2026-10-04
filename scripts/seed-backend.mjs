// Explicit one-time import of confirmed source content, never automatic startup seeding.
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const base = (process.env.PORTFOLIO_API_BASE_URL || 'http://127.0.0.1:8080/api').replace(/\/$/, '')
const origin = process.env.PORTFOLIO_FRONTEND_ORIGIN || 'http://127.0.0.1:5173'
let cookie = ''
async function source(relativePath) {
  const code = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}
async function request(path, body) {
  let response
  try {
    response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json', 'X-Admin-Request': '1' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000) })
  } catch { throw new Error('Cannot reach the API. Check the server, API URL, and frontend origin.') }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('API returned non-JSON; check PORTFOLIO_API_BASE_URL.')
  let data
  try { data = await response.json() } catch { throw new Error('API returned invalid JSON.') }
  if (!response.ok) throw new Error(`API request failed (${response.status}): ${data.error || 'unknown error'}`)
  const sessionCookie = response.headers.getSetCookie()[0]
  if (sessionCookie) cookie = sessionCookie.split(';')[0]
  return data
}
try {
  let target
  try { target = new URL(base) } catch { throw new Error('PORTFOLIO_API_BASE_URL must be a valid HTTP(S) API URL without embedded credentials.') }
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error('PORTFOLIO_API_BASE_URL must be an HTTP(S) API URL without embedded credentials.')
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) throw new Error('Set server-side CLI ADMIN_USERNAME and ADMIN_PASSWORD before importing content. Never use VITE_* variables for credentials.')
  await request('/auth/login', { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD })
  const { projects } = await source('../src/data/projects.ts')
  const { achievements } = await source('../src/data/achievements.ts')
  const savedProjects = await request('/projects?scope=admin')
  const savedAchievements = await request('/achievements?scope=admin')
  let added = 0
  for (const project of projects) {
    if (savedProjects.some((item) => item.title === project.title)) continue
    await request('/projects', { title: project.title, category: project.category, status: project.status, description: project.description, icon: project.icon, technologies: project.stack?.technologies ?? [], technologyLabel: project.stack?.label ?? 'Technologies', published: project.isPublished })
    added++
  }
  for (const achievement of achievements) {
    if (savedAchievements.some((item) => item.event === achievement.event && item.year === achievement.year)) continue
    await request('/achievements', { title: achievement.title || achievement.event, event: achievement.event, year: achievement.year, description: achievement.description ?? '', result: achievement.result, team: achievement.team ?? '', division: achievement.division ?? '', published: achievement.isPublished })
    added++
  }
  console.log(`Imported ${added} confirmed records. Existing matches were left unchanged.`)
} catch (error) { console.error(error.message); process.exitCode = 1 }
finally {
  if (cookie) {
    try { await request('/auth/logout', {}); cookie = '' }
    catch { console.error('Could not revoke the import session. It will expire automatically.'); process.exitCode = 1 }
  }
}
