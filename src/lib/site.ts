export const siteTitle = 'Md. Raihan Chowdhury | Software Developer & AI Research Enthusiast'
export const siteDescription = 'Md. Raihan Chowdhury, a Computer Science and Engineering student at SUST in Sylhet, Bangladesh, exploring software development, AI research, and reliable AI systems.'
export const siteKeywords = 'Md. Raihan Chowdhury, software development, AI research, reliable AI systems, SUST'
export const socialImageAlt = 'Md. Raihan Chowdhury — Software Developer & AI Research Enthusiast'

// Public build configuration only. Invalid values fail the build without echoing them.
export function siteURL(value?: string) {
  if (!value?.trim()) return undefined
  let url: URL
  try { url = new URL(value.trim()) } catch { throw new Error('VITE_SITE_URL must be an absolute HTTPS homepage URL.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('VITE_SITE_URL must use HTTPS without credentials, query strings, or fragments.')
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`
  return url.href
}

export function validateAPIURL(value?: string) {
  const base = value?.trim()
  if (!base) return
  if (base.startsWith('/') && !base.startsWith('//')) {
    if (!/^\/(?:[\w-]+\/)*[\w-]+\/?$/.test(base)) throw new Error('VITE_API_BASE_URL must be a root-relative API path or HTTP(S) URL without credentials, queries, or fragments.')
    return
  }
  let url: URL
  try { url = new URL(base) } catch { throw new Error('VITE_API_BASE_URL must be a root-relative API path or absolute HTTP(S) URL.') }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) throw new Error('VITE_API_BASE_URL requires HTTPS except on localhost, and cannot contain credentials, queries, or fragments.')
}
