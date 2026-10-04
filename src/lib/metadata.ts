import type { FrontendRoute } from './routes'
import { siteDescription, siteTitle } from './site'

export function setPageMetadata(route: FrontendRoute | 'error') {
  if (route === 'public') return // Public metadata is already in the generated HTML.
  const titles = { admin: 'Admin workspace', login: 'Admin sign in', 'not-found': 'Page not found', error: 'Page unavailable' }
  document.title = `${titles[route]} | Md. Raihan Chowdhury`
  const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
  if (robots) robots.content = 'noindex, nofollow'
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (description) description.content = route === 'not-found' ? 'This page could not be found. Return to the portfolio of Md. Raihan Chowdhury.' : route === 'error' ? 'The page is temporarily unavailable. Please reload and try again.' : 'Admin access for the portfolio of Md. Raihan Chowdhury.'
  // Do not advertise a public canonical or social preview for private/unknown routes.
  document.querySelectorAll('link[rel="canonical"], meta[property^="og:"], meta[name^="twitter:"], meta[name="keywords"]').forEach((element) => element.remove())
}

export { siteTitle, siteDescription }
