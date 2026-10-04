import { APIError, request } from './api'

export type AdminSession = { admin: { username: string }; expiresAt: string }

function session(value: AdminSession): AdminSession {
  if (typeof value?.admin?.username !== 'string' || !value.admin.username || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))) throw new APIError('The API returned an invalid session response.')
  // Keep only display information; session credentials stay in the HttpOnly cookie.
  return { admin: { username: value.admin.username }, expiresAt: value.expiresAt }
}

export const authAPI = {
  async me(signal?: AbortSignal) { return session(await request<AdminSession>('/auth/me', { signal })) },
  async login(username: string, password: string) { return session(await request<AdminSession>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })) },
  async logout() { await request('/auth/logout', { method: 'POST' }) },
}
