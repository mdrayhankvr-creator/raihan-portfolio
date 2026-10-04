import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'

const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/export /g, '')
const source = await compile('../src/lib/site.ts')
const routes = await compile('../src/lib/routes.ts')
const plugin = (await compile('../scripts/seo.ts')).replace(/^import .*from .*;\s*/gm, '')
const context = { URL, Error }
vm.runInNewContext(source+'\n'+routes+'\n'+plugin+'\nglobalThis.api = { siteURL, validateAPIURL, frontendRoute, portfolioSEO };', context)
const { siteURL, validateAPIURL, frontendRoute, portfolioSEO } = context.api

test('canonical and image URLs require explicit configuration and never use a guessed domain', () => {
  for (const value of [undefined, '', '  ']) assert.equal(siteURL(value), undefined)
  const withoutDomain = portfolioSEO({}).transformIndexHtml.handler()
  assert.equal(withoutDomain.some(t => t.attrs.rel === 'canonical' || ['og:url', 'og:image'].includes(t.attrs.property)), false)
  const title = withoutDomain.find(t => t.attrs.property === 'og:title').attrs.content
  assert.equal(title, 'Md. Raihan Chowdhury | Software Developer & AI Research Enthusiast')
  const tags = portfolioSEO({ VITE_SITE_URL: 'https://portfolio.example/portfolio' }).transformIndexHtml.handler()
  assert.equal(tags.find(t => t.attrs.rel === 'canonical').attrs.href, 'https://portfolio.example/portfolio/')
  assert.equal(tags.find(t => t.attrs.property === 'og:image').attrs.content, 'https://portfolio.example/portfolio/social-card.jpg')
  assert.equal(tags.find(t => t.attrs.name === 'twitter:card').attrs.content, 'summary_large_image')
})

test('unsafe site/API configuration is rejected without echoing potentially secret values', () => {
  for (const value of ['http://portfolio.example', 'https://user:private-value@portfolio.example', 'https://portfolio.example/?secret=private-value', 'https://portfolio.example/#private-value']) {
    assert.throws(() => siteURL(value), error => !error.message.includes('private-value'))
  }
  for (const value of ['/api', '/portfolio/api/', 'https://api.portfolio.example/api', 'http://127.0.0.1:8080/api', undefined]) validateAPIURL(value)
  for (const value of ['//api.example/api', '/api//', 'http://api.example/api', 'https://user:private-value@api.example/api', '/api?password=private-value', 'https://api.example/api#private-value']) {
    assert.throws(() => validateAPIURL(value), error => !error.message.includes('private-value'))
  }
})

test('frontend routes distinguish public/admin/not-found under root and deployment subpaths', () => {
  for (const base of ['/', '/portfolio/']) {
    const prefix = base.replace(/\/$/, '')
    for (const path of [prefix || '/', prefix+'/', prefix+'/index.html']) assert.equal(frontendRoute(path, base), 'public')
    assert.equal(frontendRoute(prefix+'/admin/', base), 'admin')
    assert.equal(frontendRoute(prefix+'/admin/login', base), 'login')
    for (const path of [prefix+'/admin/unknown', prefix+'/unknown', prefix+'/projects']) assert.equal(frontendRoute(path, base), 'not-found')
  }
  assert.equal(frontendRoute('/portfolio-other', '/portfolio/'), 'not-found')
})
