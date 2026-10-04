import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/analytics.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source.replaceAll('import.meta.env', '__viteEnv'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText
// Synthetic fixture only. Scripts are captured in memory and never requested.
const testId = 'G-' + 'TESTONLY01'

function setup({ id = testId, privacy = {}, server = false, blocked = false } = {}) {
  const scripts = []
  const browser = { navigator: { doNotTrack: null, ...privacy }, location: { origin: 'https://portfolio.example' } }
  for (const field of ['href', 'pathname', 'search', 'hash']) {
    Object.defineProperty(browser.location, field, { get() { throw Error(`Must not read visitor URL ${field}`) } })
  }
  const document = {
    createElement(tag) { assert.equal(tag, 'script'); return {} },
    head: { appendChild(script) { if (blocked) throw Error('Blocked script'); scripts.push(script) } },
    get title() { throw Error('Must not read personal document title') },
    get referrer() { throw Error('Must not read visitor referrer') },
  }
  const context = vm.createContext({
    exports: {}, URL, Date,
    __viteEnv: { VITE_GA_MEASUREMENT_ID: id, BASE_URL: '/portfolio/' },
    ...(server ? {} : { window: browser, document }),
  })
  vm.runInContext(compiled, context)
  const commands = () => JSON.parse(JSON.stringify((browser.dataLayer ?? []).map(entry => Array.from(entry))))
  return { api: context.exports, browser, scripts, commands }
}

test('missing, blank, or invalid configuration performs no initialization', () => {
  for (const id of [null, '', '   ', 'invalid', 'G-<script>']) {
    const { api, browser, scripts } = setup({ id })
    assert.equal(api.initializeAnalytics(), false)
    assert.doesNotThrow(() => api.trackPageView())
    assert.equal(scripts.length, 0)
    assert.equal(browser.dataLayer, undefined)
    assert.equal(browser.gtag, undefined)
  }
})

test('initialization is optional outside the browser', () => {
  const { api } = setup({ server: true })
  assert.equal(api.initializeAnalytics(), false)
  assert.doesNotThrow(() => api.trackPageView())
})

test('browser privacy opt-outs prevent all tracking', () => {
  for (const privacy of [{ doNotTrack: '1' }, { doNotTrack: 'yes' }, { globalPrivacyControl: true }]) {
    const { api, browser, scripts } = setup({ privacy })
    assert.equal(api.initializeAnalytics(), false)
    api.trackPageView()
    assert.equal(scripts.length, 0)
    assert.equal(browser.dataLayer, undefined)
  }
})

test('one asynchronous script and one page view, even on repeated React effects', () => {
  const { api, scripts, commands } = setup({ id: ` ${testId} ` })
  api.trackPageView()
  for (let i = 0; i < 2; i++) {
    assert.equal(api.initializeAnalytics(), true)
    api.trackPageView()
  }
  assert.equal(scripts.length, 1)
  assert.equal(scripts[0].async, true)
  assert.equal(scripts[0].referrerPolicy, 'no-referrer')
  assert.equal(scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${testId}`)
  const events = commands().filter(entry => entry[0] === 'event')
  assert.deepEqual(events, [['event', 'page_view', {
    page_location: 'https://portfolio.example/portfolio/', page_title: 'Portfolio', page_referrer: '', send_to: testId,
  }]])
  assert.deepEqual(commands()[0], ['consent', 'default', {
    analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  }])
  const settings = commands().find(entry => entry[0] === 'set')[1]
  assert.equal(settings.allow_google_signals, false)
  assert.equal(settings.allow_ad_personalization_signals, false)
  assert.equal(settings.url_passthrough, false)
  assert.equal(settings.ads_data_redaction, true)
  assert.deepEqual(commands().find(entry => entry[0] === 'config'), ['config', testId, { send_page_view: false }])
})

test('a privacy opt-out after initialization suppresses the pending page view', () => {
  const { api, browser, commands } = setup()
  api.initializeAnalytics()
  browser.navigator.globalPrivacyControl = true
  api.trackPageView()
  assert.equal(commands().filter(entry => entry[0] === 'event').length, 0)
})

test('script or tag failures do not propagate to React', () => {
  const blocked = setup({ blocked: true })
  assert.equal(blocked.api.initializeAnalytics(), false)
  assert.doesNotThrow(() => blocked.api.trackPageView())
  assert.equal(blocked.commands().filter(entry => entry[0] === 'event').length, 0)

  const failed = setup()
  failed.api.initializeAnalytics()
  failed.browser.gtag = () => { throw Error('Unavailable tag') }
  assert.doesNotThrow(() => failed.api.trackPageView())
})
