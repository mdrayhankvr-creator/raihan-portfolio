import type { HtmlTagDescriptor, Plugin } from 'vite'
import { siteDescription, siteKeywords, siteTitle, siteURL, socialImageAlt, validateAPIURL } from '../src/lib/site.ts'

export function portfolioSEO(env: Record<string, string>): Plugin {
  const homepage = siteURL(env.VITE_SITE_URL)
  validateAPIURL(env.VITE_API_BASE_URL)
  const meta = (name: string, content: string, property = false): HtmlTagDescriptor => ({ tag: 'meta', attrs: { [property ? 'property' : 'name']: name, content }, injectTo: 'head' })
  return {
    name: 'portfolio-seo',
    transformIndexHtml: {
      order: 'post',
      handler() {
        const tags = [
          meta('description', siteDescription),
          meta('keywords', siteKeywords),
          meta('robots', 'index, follow'),
          meta('og:type', 'website', true),
          meta('og:site_name', 'Md. Raihan Chowdhury', true),
          meta('og:title', siteTitle, true),
          meta('og:description', siteDescription, true),
          meta('og:locale', 'en_US', true),
          meta('twitter:card', homepage ? 'summary_large_image' : 'summary'),
          meta('twitter:title', siteTitle),
          meta('twitter:description', siteDescription),
        ]
        if (homepage) {
          const image = new URL('social-card.jpg', homepage).href
          tags.push(
            { tag: 'link', attrs: { rel: 'canonical', href: homepage }, injectTo: 'head' },
            meta('og:url', homepage, true),
            meta('og:image', image, true),
            meta('og:image:type', 'image/jpeg', true),
            meta('og:image:width', '1200', true),
            meta('og:image:height', '630', true),
            meta('og:image:alt', socialImageAlt, true),
            meta('twitter:image', image),
            meta('twitter:image:alt', socialImageAlt),
          )
        }
        return tags
      },
    },
  }
}
