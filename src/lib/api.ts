import type { Project } from '../data/projects'
import type { Achievement } from '../data/achievements'

const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim()
const base = (configuredBase || '/api').replace(/\/$/, '')
export const publicAPIConfigured = Boolean(configuredBase)

type Timestamps = { id: string; createdAt: string; updatedAt: string }
type ProjectResponse = Timestamps & {
  title: string; category: string; status: Project['status']; description: string
  technologies: string[]; technologyLabel: NonNullable<Project['stack']>['label']
  icon: Project['icon']; published: boolean
}
type AchievementResponse = Timestamps & {
  title: string; event: string; year: number; description: string; result: string
  team?: string; division?: string; published: boolean
}

export class APIError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) { super(message); this.name = 'APIError'; this.status = status }
}

export const sessionExpiredEvent = 'portfolio:session-expired'

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000)
  let response: Response
  try {
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(options.method ?? 'GET')
    response = await fetch(`${base}${path}`, { ...options, signal, cache: 'no-store', credentials: options.credentials ?? 'include', headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(write ? { 'X-Admin-Request': '1' } : {}) } })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new APIError('Cannot reach the portfolio API. Check that the Go server is running and the API URL is configured correctly.')
  }
  if (response.status === 401 && !path.startsWith('/auth/') && typeof window !== 'undefined') window.dispatchEvent(new Event(sessionExpiredEvent))
  if (!response.headers.get('content-type')?.includes('application/json')) throw new APIError('The API did not return JSON. Check the API URL or reverse proxy configuration.', response.status)
  let data: T
  try { data = await response.json() as T } catch { throw new APIError('The API returned an invalid JSON response.', response.status) }
  if (!response.ok) {
    // Never display arbitrary server/proxy response text, which may contain secrets.
    const messages: Record<number, string> = {
      400: 'Check the form fields and try again.',
      401: path === '/auth/login' ? 'Invalid username or password' : 'Authentication required. Please sign in again.',
      403: 'This request is not allowed. Check your account and the site connection configuration.',
      404: 'Record not found. Reload the content and try again.',
      429: 'Too many login attempts. Please try again shortly.',
    }
    throw new APIError(messages[response.status] ?? (response.status >= 500 ? 'The service is temporarily unavailable. Please try again.' : 'The request failed. Please try again.'), response.status)
  }
  return data
}

function projectFromAPI(record: ProjectResponse): Project {
  return { id: record.id, title: record.title, category: record.category, status: record.status, description: record.description, icon: record.icon, isPublished: record.published,
    createdAt: record.createdAt, updatedAt: record.updatedAt,
    ...(record.technologies.length ? { stack: { label: record.technologyLabel, technologies: record.technologies } } : {}),
  }
}
function achievementFromAPI(record: AchievementResponse): Achievement {
  return { id: record.id, title: record.title, event: record.event, year: record.year, description: record.description, result: record.result, team: record.team, division: record.division, isPublished: record.published, createdAt: record.createdAt, updatedAt: record.updatedAt }
}
function projectBody(record: Omit<Project, 'id'>) {
  return JSON.stringify({ title: record.title, category: record.category, status: record.status, description: record.description, icon: record.icon, technologies: record.stack?.technologies ?? [], technologyLabel: record.stack?.label ?? 'Technologies', published: record.isPublished })
}
function achievementBody(record: Omit<Achievement, 'id'>) {
  return JSON.stringify({ title: record.title || record.event, event: record.event, year: record.year, description: record.description ?? '', result: record.result, team: record.team ?? '', division: record.division ?? '', published: record.isPublished })
}

export const contentAPI = {
  async projects(signal?: AbortSignal, publishedOnly = false) { return (await request<ProjectResponse[]>(`/projects${publishedOnly ? '?published=true' : '?scope=admin'}`, { signal, credentials: publishedOnly ? 'omit' : 'include' })).map(projectFromAPI) },
  async achievements(signal?: AbortSignal, publishedOnly = false) { return (await request<AchievementResponse[]>(`/achievements${publishedOnly ? '?published=true' : '?scope=admin'}`, { signal, credentials: publishedOnly ? 'omit' : 'include' })).map(achievementFromAPI) },
  async saveProject(record: Omit<Project, 'id'>, id?: string) { return projectFromAPI(await request<ProjectResponse>(`/projects${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body: projectBody(record) })) },
  async saveAchievement(record: Omit<Achievement, 'id'>, id?: string) { return achievementFromAPI(await request<AchievementResponse>(`/achievements${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body: achievementBody(record) })) },
  async deleteProject(id: string) { await request(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }) },
  async deleteAchievement(id: string) { await request(`/achievements/${encodeURIComponent(id)}`, { method: 'DELETE' }) },
}

export function apiErrorMessage(error: unknown) { return error instanceof APIError ? error.message : 'The request failed. Please try again.' }
