import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { BrainCircuit, GitBranch, MessagesSquare, ScanSearch, ShieldCheck, Workflow } from 'lucide-react'
import './Research.css'

type ResearchProps = {
  id?: string
}

const explorationAreas = [
  {
    title: 'Artificial Intelligence',
    description: 'Understanding the foundations behind intelligent systems.',
    icon: BrainCircuit,
  },
  {
    title: 'AI Agent Reliability',
    description: 'Exploring what makes agent behavior dependable.',
    icon: ShieldCheck,
  },
  {
    title: 'AI Agent Evaluation',
    description: 'Learning how to assess task success, tool use, and factual accuracy.',
    icon: ScanSearch,
  },
  {
    title: 'Reliable AI Systems',
    description: 'Exploring how software engineering can support trustworthy AI systems.',
    icon: Workflow,
  },
  {
    title: 'LLM-based systems',
    description: 'Understanding how language models fit into broader software systems.',
    icon: MessagesSquare,
  },
  {
    title: 'AI research',
    description: 'Developing my understanding of research questions and methods in AI.',
    icon: GitBranch,
  },
] as const

export default function Research({ id = 'research' }: ResearchProps) {
  const headingId = useId()
  const focusHeadingId = useId()
  const areasHeadingId = useId()
  const shouldReduceMotion = useReducedMotion()
  const entrance = {
    initial: shouldReduceMotion ? false as const : { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: shouldReduceMotion ? 0 : 0.35, ease: 'easeOut' as const },
  }

  return (
    <section className="research" id={id} aria-labelledby={headingId} tabIndex={-1}>
      <div className="container research__inner">
        <motion.div className="research__header" {...entrance}>
          <p className="research__eyebrow">Interests &amp; exploration</p>
          <h2 className="research__title" id={headingId}>AI &amp; Research</h2>
          <p className="research__intro">
            Building my understanding of AI, with an interest in how intelligent systems
            behave, how we evaluate them, and how we make them reliable.
          </p>
        </motion.div>

        <div className="research__layout">
          <motion.div
            className="research__focus surface surface--glass"
            role="group"
            aria-labelledby={focusHeadingId}
            {...entrance}
          >
            <div className="research__network" aria-hidden="true">
              <svg className="research__connections" viewBox="0 0 280 160" fill="none">
                <path d="M140 72V30M140 72L52 128M140 72L228 128" />
                <circle cx="140" cy="72" r="48" />
                <circle cx="140" cy="72" r="67" />
              </svg>
              <span className="research__node research__node--core"><BrainCircuit size={30} strokeWidth={1.5} /></span>
              <span className="research__node research__node--top"><GitBranch size={18} strokeWidth={1.5} /></span>
              <span className="research__node research__node--left"><ScanSearch size={20} strokeWidth={1.5} /></span>
              <span className="research__node research__node--right"><ShieldCheck size={20} strokeWidth={1.5} /></span>
            </div>
            <p className="research__caption">Learning direction</p>
            <h3 className="research__focus-title" id={focusHeadingId}>Research Focus</h3>
            <p className="research__focus-description">
              I'm exploring how AI agents and LLM-based systems can be evaluated and
              made more reliable. My interests sit at the intersection of software
              engineering and AI research.
            </p>
            <p className="research__note">These are areas I'm learning about and developing in.</p>
          </motion.div>

          <div className="research__areas" role="group" aria-labelledby={areasHeadingId}>
            <motion.h3 className="research__areas-title" id={areasHeadingId} {...entrance}>
              Areas I'm Exploring
            </motion.h3>
            <ul className="research__area-list">
              {explorationAreas.map(({ title, description, icon: Icon }, index) => (
                <motion.li
                  className="research__area surface"
                  key={title}
                  {...entrance}
                  transition={{ ...entrance.transition, delay: shouldReduceMotion ? 0 : index * 0.04 }}
                >
                  <span className="research__area-icon" aria-hidden="true">
                    <Icon size={21} strokeWidth={1.5} />
                  </span>
                  <h4 className="research__area-title">{title}</h4>
                  <p className="research__area-description">{description}</p>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
