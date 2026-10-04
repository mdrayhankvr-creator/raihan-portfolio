import { lazy, Suspense, useEffect } from 'react'
import { initializeAnalytics, trackPageView } from './lib/analytics'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/About'
import Skills from './components/Skills'
import Projects from './components/Projects'
import Research from './components/Research'
import Achievements from './components/Achievements'
import Contact from './components/Contact'
import { contentAPI } from './lib/api'
import { usePublicContent } from './hooks/usePublicContent'
import { projects } from './data/projects'
import { achievements } from './data/achievements'
import { frontendRoute } from './lib/routes'
import { setPageMetadata } from './lib/metadata'
import PageState from './components/PageState'

const AdminAccess = lazy(() => import('./components/admin/AdminAccess'))
const NotFound = lazy(() => import('./pages/NotFound'))

// API updates stay within their sections instead of re-rendering the whole page.
function ProjectContent() {
  const projectContent = usePublicContent(contentAPI.projects, projects)
  return <Projects projects={projectContent.records} loading={projectContent.loading} error={projectContent.error} onRetry={projectContent.reload} />
}

function AchievementContent() {
  const achievementContent = usePublicContent(contentAPI.achievements, achievements)
  return <Achievements achievements={achievementContent.records} loading={achievementContent.loading} error={achievementContent.error} onRetry={achievementContent.reload} />
}

function PublicPortfolio() {
  useEffect(() => {
    if (initializeAnalytics()) trackPageView()
  }, [])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#portfolio-content">Skip to main content</a>
      <Navbar />
      <main id="portfolio-content" tabIndex={-1}>
        <Hero />
        <About />
        <Skills />
        <ProjectContent />
        <Research />
        <AchievementContent />
        <Contact />
      </main>
    </div>
  )
}

export default function App() {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin).pathname
  const route = frontendRoute(window.location.pathname, base)
  useEffect(() => { setPageMetadata(route) }, [route])

  if (route === 'admin' || route === 'login') {
    return (
      <Suspense fallback={<PageState title="Admin workspace" description="Loading your workspace…" loading />}>
        <AdminAccess loginPage={route === 'login'} />
      </Suspense>
    )
  }

  if (route === 'not-found') return <Suspense fallback={<PageState title="Loading page" description="Please wait…" loading />}><NotFound /></Suspense>

  return <PublicPortfolio />
}
