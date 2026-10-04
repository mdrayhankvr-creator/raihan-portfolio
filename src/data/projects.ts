export type Project = {
  id: string
  title: string
  category: string
  status: 'Completed' | 'In Progress'
  description: string
  icon: 'link' | 'ai' | 'dashboard'
  stack?: {
    label: 'Technologies' | 'Proposed stack'
    technologies: readonly string[]
  }
  isPublished: boolean
  createdAt?: string
  updatedAt?: string
}

// Serializable source records shared by the portfolio and the admin preview.
export const projects: readonly Project[] = [
  {
    id: 'go-url-shortener',
    title: 'Go URL Shortener',
    category: 'HTTP service',
    status: 'Completed',
    description: 'A URL shortening service built with Go and MongoDB, with an HTTP API for creating short URLs and redirecting users.',
    icon: 'link',
    stack: { label: 'Technologies', technologies: ['Go', 'MongoDB', 'REST API', 'Docker'] },
    isPublished: true,
  },
  {
    id: 'ai-agent-evaluation',
    title: 'AiScorer / teamGuardAi',
    category: 'Agent reliability & evaluation',
    status: 'In Progress',
    description: 'An AI agent reliability and evaluation platform focused on task success, tool selection, factual accuracy, policy compliance, hallucination, latency, and cost.',
    icon: 'ai',
    stack: { label: 'Proposed stack', technologies: ['Go or Python', 'React', 'PostgreSQL', 'Docker'] },
    isPublished: true,
  },
  {
    id: 'lazylife-dashboard',
    title: 'LazyLife Dashboard',
    category: 'Productivity concept',
    status: 'In Progress',
    description: 'A personal productivity dashboard concept for routines, academic schedules, tutoring, earnings, and expenses.',
    icon: 'dashboard',
    isPublished: true,
  },
]
