export type FrontendRoute = 'public' | 'admin' | 'login' | 'not-found'

export function frontendRoute(pathname: string, basePath = '/'): FrontendRoute {
  const path = pathname.replace(/\/+$/, '')
  const base = basePath.replace(/\/+$/, '')
  if (path === base || path === `${base}/index.html`) return 'public'
  if (path === `${base}/admin`) return 'admin'
  if (path === `${base}/admin/login`) return 'login'
  return 'not-found'
}
