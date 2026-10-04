import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Code2, Layers, Wrench } from 'lucide-react'
import './Skills.css'

type SkillsProps = {
  id?: string
}

const skillCategories = [
  {
    id: 'languages',
    title: 'Languages',
    icon: Code2,
    technologies: ['C', 'C++', 'Python', 'Go', 'Java'],
  },
  {
    id: 'development',
    title: 'Development',
    icon: Layers,
    technologies: ['React', 'MongoDB'],
  },
  {
    id: 'tools',
    title: 'Tools & Technologies',
    icon: Wrench,
    technologies: ['Docker', 'Git', 'GitHub'],
  },
] as const

export default function Skills({ id = 'skills' }: SkillsProps) {
  const headingId = useId()
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="skills" id={id} aria-labelledby={headingId} tabIndex={-1}>
      <div className="container skills__inner">
        <motion.div
          className="skills__header"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.35, ease: 'easeOut' }}
        >
          <p className="skills__eyebrow">Technical toolkit</p>
          <h2 className="skills__title" id={headingId}>Skills</h2>
          <p className="skills__intro">
            Technologies I've worked with in software development.
          </p>
        </motion.div>

        <div className="skills__cards">
          {skillCategories.map(({ id: categoryId, title, icon: Icon, technologies }, index) => (
            <motion.article
              className="skills__card surface surface--glass"
              data-category={categoryId}
              key={categoryId}
              aria-labelledby={`${headingId}-${categoryId}`}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.35,
                delay: shouldReduceMotion ? 0 : index * 0.06,
                ease: 'easeOut',
              }}
            >
              <div className="skills__card-header">
                <span className="skills__card-icon" aria-hidden="true">
                  <Icon size={22} strokeWidth={1.5} />
                </span>
                <h3 className="skills__category-title" id={`${headingId}-${categoryId}`}>
                  {title}
                </h3>
              </div>

              <ul className="skills__technologies">
                {technologies.map((technology) => (
                  <li className="skills__technology" key={technology}>{technology}</li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
