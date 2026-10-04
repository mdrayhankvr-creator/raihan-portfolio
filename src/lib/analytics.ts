type PageDetails = {
  page_location: string
  page_title: 'Portfolio'
  page_referrer: ''
}

type Gtag = (...args:
  | ['js', Date]
  | ['consent', 'default', Record<'analytics_storage' | 'ad_storage' | 'ad_user_data' | 'ad_personalization', 'denied'>]
  | ['set', PageDetails & {
    allow_google_signals: false
    allow_ad_personalization_signals: false
    url_passthrough: false
    ads_data_redaction: true
  }]
  | ['config', string, { send_page_view: false }]
  | ['event', 'page_view', PageDetails & { send_to: string }]
) => void

type AnalyticsWindow = Window & {
  dataLayer?: unknown[]
  gtag?: Gtag
}

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()
let initialized = false
let pageViewSent = false

function canTrack(): boolean {
  if (typeof window === 'undefined' || !measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) return false

  const privacyNavigator = window.navigator as Navigator & { globalPrivacyControl?: boolean }
  return privacyNavigator.doNotTrack !== '1'
    && privacyNavigator.doNotTrack !== 'yes'
    && privacyNavigator.globalPrivacyControl !== true
}

function pageDetails(): PageDetails {
  return {
    // This single-page portfolio has no routes. Never read visitor-supplied URLs,
    // query strings, hash fragments, referrers, or the personal document title.
    page_location: new URL(import.meta.env.BASE_URL, window.location.origin).href,
    page_title: 'Portfolio',
    page_referrer: '',
  }
}

export function initializeAnalytics(): boolean {
  if (!measurementId || !canTrack()) return false
  if (initialized) return true

  try {
    const analyticsWindow = window as AnalyticsWindow
    analyticsWindow.dataLayer ??= []
    analyticsWindow.gtag ??= function (..._args: Parameters<Gtag>) {
      // Google's tag consumes queued argument objects after the async script loads.
      analyticsWindow.dataLayer?.push(arguments)
    }
    const gtag = analyticsWindow.gtag

    gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
    gtag('set', {
      ...pageDetails(),
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      url_passthrough: false,
      ads_data_redaction: true,
    })
    gtag('js', new Date())
    gtag('config', measurementId, { send_page_view: false })

    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
    script.referrerPolicy = 'no-referrer'
    document.head.appendChild(script)
    initialized = true
    return true
  } catch {
    // Optional analytics must never prevent the portfolio from rendering.
    return false
  }
}

export function trackPageView(): void {
  if (!measurementId || !initialized || pageViewSent || !canTrack()) return

  try {
    const gtag = (window as AnalyticsWindow).gtag
    if (!gtag) return

    gtag('event', 'page_view', { ...pageDetails(), send_to: measurementId })
    // Also prevents React StrictMode's repeated effect from double-counting.
    // Section anchors are navigation within this page, not additional page views.
    pageViewSent = true
  } catch {
    // Ad blockers or unavailable analytics must not affect the app.
  }
}
