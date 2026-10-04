import { useId, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Braces, Cpu, MapPin, Network, Send } from 'lucide-react'
import './Hero.css'

// An optional glob keeps missing/replaced assets from breaking Vite's build.
const profileImages = import.meta.glob<string>('../assets/profile-400.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const profilePhoto = ['jpg', 'jpeg', 'png', 'webp', 'avif']
  .map((extension) => profileImages[`../assets/profile-400.${extension}`])
  .find(Boolean)

type HeroProps = {
  id?: string
  projectsHref?: string
  contactHref?: string
}

export default function Hero({
  id = 'home',
  projectsHref = '#projects',
  contactHref = '#contact',
}: HeroProps) {
  const headingId = useId()
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="hero" id={id} aria-labelledby={headingId}>
      <div className="container hero__inner">
        <motion.div
          className="hero__content"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: 'easeOut' }}
        >
          <p className="hero__status">
            <span className="hero__status-dot" aria-hidden="true" />
            Software Development · AI Research
          </p>

          <h1 className="hero__title" id={headingId}>
            <span>Md. Raihan</span>{' '}
            <span className="hero__name-accent">Chowdhury</span>
          </h1>

          <p className="hero__intro">
            A software developer interested in AI, AI research, and reliable AI systems.
          </p>

          <div className="hero__actions">
            <a className="hero__cta hero__cta--primary" href={projectsHref}>
              View Projects
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </a>
            <a className="hero__cta hero__cta--secondary" href={contactHref}>
              Contact Me
              <Send size={17} strokeWidth={1.75} aria-hidden="true" />
            </a>
          </div>

          <dl className="hero__details">
            <div className="hero__detail">
              <dt>Field</dt>
              <dd>Computer Science &amp; Engineering</dd>
            </div>
            <div className="hero__detail">
              <dt>Location</dt>
              <dd className="hero__location">
                <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
                Sylhet, Bangladesh
              </dd>
            </div>
            <div className="hero__detail hero__detail--wide">
              <dt>University</dt>
              <dd>Shahjalal University of Science and Technology (SUST)</dd>
            </div>
          </dl>
        </motion.div>

        <motion.div
          className="hero__visual"
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.5,
            delay: shouldReduceMotion ? 0 : 0.08,
            ease: 'easeOut',
          }}
        >
          <div className="hero__visual-art" aria-hidden="true">
            <div className="hero__visual-grid" />
            <div className="hero__orbit hero__orbit--outer" />
            <div className="hero__orbit hero__orbit--inner" />
            <svg className="hero__connections" viewBox="0 0 360 360" fill="none" focusable="false">
              <path d="M79 101L180 180L288 97M180 180L263 288" />
              <path className="hero__connection-secondary" d="M79 101L288 97L263 288L79 101" />
              <circle cx="180" cy="180" r="6" />
            </svg>
            <span className="hero__node hero__node--code surface">
              <Braces size={22} strokeWidth={1.5} />
            </span>
            <span className="hero__node hero__node--compute surface">
              <Cpu size={22} strokeWidth={1.5} />
            </span>
            <span className="hero__node hero__node--network surface">
              <Network size={22} strokeWidth={1.5} />
            </span>
          </div>
          <div className="hero__portrait surface surface--glass">
            {profilePhoto && failedPhoto !== profilePhoto ? (
              <img
                className="hero__photo"
                src={profilePhoto}
                width={400}
                height={429}
                alt="Portrait of Md. Raihan Chowdhury"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={() => setFailedPhoto(profilePhoto)}
              />
            ) : (
              <span
                className="hero__photo-fallback"
                role="img"
                aria-label="Profile photo unavailable for Md. Raihan Chowdhury"
              >
                MRC
              </span>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
