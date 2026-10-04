import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { BrainCircuit, CheckCircle2, Clock3, Link2, PanelsTopLeft } from 'lucide-react'
import { projects as projectData } from '../data/projects'
import type { Project } from '../data/projects'
import './Projects.css'

type ProjectsProps = {
  id?: string
  projects?: readonly Project[]
  loading?: boolean
  error?: string
  onRetry?: () => Promise<void>
}

const projectIcons = { link: Link2, ai: BrainCircuit, dashboard: PanelsTopLeft }

export default function Projects({ id = 'projects', projects = projectData, loading, error, onRetry }: ProjectsProps) {
  const headingId = useId()
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="projects" id={id} aria-labelledby={headingId} aria-busy={loading} tabIndex={-1}>
      <div className="container projects__inner">
        <motion.div
          className="projects__header"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.35, ease: 'easeOut' }}
        >
          <p className="projects__eyebrow">Work &amp; exploration</p>
          <h2 className="projects__title" id={headingId}>Projects</h2>
          <p className="projects__intro">
            Software development, AI agent evaluation, and personal productivity.
          </p>
        </motion.div>

        {(loading || error) && <div className="content-feedback"><p className="projects__intro" role={error ? 'alert' : 'status'}>{error || 'Loading projects…'}</p>{error && onRetry && <button className="content-retry" type="button" onClick={() => void onRetry()} aria-label="Retry loading projects">Try again</button>}</div>}
        {!loading && !error && !projects.some((project) => project.isPublished) && <p className="projects__intro">No published projects yet.</p>}
        <div className="projects__cards">
          {projects.filter((project) => project.isPublished).map(({ id: projectId, title, category, status, description, icon, stack }, index) => {
            const Icon = projectIcons[icon]
            const StatusIcon = status === 'Completed' ? CheckCircle2 : Clock3

            return (
              <motion.article
                className="projects__card surface surface--glass"
                key={projectId}
                data-project={projectId}
                data-status={status}
                aria-labelledby={`${headingId}-${projectId}`}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.35,
                  delay: shouldReduceMotion ? 0 : index * 0.06,
                  ease: 'easeOut',
                }}
              >
                <div className="projects__card-top">
                  <span className="projects__card-icon" aria-hidden="true">
                    <Icon size={25} strokeWidth={1.5} />
                  </span>
                  <span className="projects__status">
                    <StatusIcon size={14} strokeWidth={1.75} aria-hidden="true" />
                    {status}
                  </span>
                </div>

                <p className="projects__category">{category}</p>
                <h3 className="projects__project-title" id={`${headingId}-${projectId}`}>{title}</h3>
                <p className="projects__description">{description}</p>

                {stack && (
                  <div className="projects__stack">
                    <p className="projects__stack-label">{stack.label}</p>
                    <ul className="projects__technologies" aria-label={stack.label}>
                      {stack.technologies.map((technology) => (
                        <li className="projects__technology" key={technology}>{technology}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
