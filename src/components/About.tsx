import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { BookOpen, BrainCircuit, Code2, MapPin, Puzzle, Shield, UserRound } from 'lucide-react'
import './About.css'

type AboutProps = {
  id?: string
}

const areasOfInterest = [
  { label: 'Software development', icon: Code2 },
  { label: 'AI & AI research', icon: BrainCircuit },
  { label: 'Reliable AI systems', icon: Shield },
  { label: 'Problem solving', icon: Puzzle },
] as const

export default function About({ id = 'about' }: AboutProps) {
  const headingId = useId()
  const cardHeadingId = useId()
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="about" id={id} aria-labelledby={headingId} tabIndex={-1}>
      <div className="container about__inner">
        <motion.div
          className="about__content"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.35, ease: 'easeOut' }}
        >
          <p className="about__eyebrow">
            <UserRound size={16} strokeWidth={1.75} aria-hidden="true" />
            Background
          </p>
          <h2 className="about__title" id={headingId}>About me</h2>

          <p className="about__lead">
            I'm a Computer Science and Engineering student at Shahjalal University of
            Science and Technology (SUST).
          </p>
          <p className="about__description">
            I'm developing strong software engineering foundations, with a focus on
            software development and problem solving. Alongside that, I'm exploring
            AI, AI research, and reliable AI systems.
          </p>

          <p className="about__location">
            <MapPin size={17} strokeWidth={1.75} aria-hidden="true" />
            Sylhet, Bangladesh
          </p>
        </motion.div>

        <motion.aside
          className="about__card surface surface--glass"
          aria-labelledby={cardHeadingId}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: 'easeOut' }}
        >
          <div className="about__card-header">
            <span className="about__card-mark" aria-hidden="true">
              <BookOpen size={22} strokeWidth={1.5} />
            </span>
            <div>
              <p className="about__card-caption">Learning &amp; exploration</p>
              <h3 className="about__card-title" id={cardHeadingId}>Areas of interest</h3>
            </div>
          </div>

          <ul className="about__interests">
            {areasOfInterest.map(({ label, icon: Icon }) => (
              <li className="about__interest" key={label}>
                <span className="about__interest-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.5} />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </motion.aside>
      </div>
    </section>
  )
}
