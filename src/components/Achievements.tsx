import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CalendarDays, Flag, MapPin, UsersRound } from 'lucide-react'
import { achievements as achievementData } from '../data/achievements'
import type { Achievement } from '../data/achievements'
import './Achievements.css'

type AchievementsProps = {
  id?: string
  achievements?: readonly Achievement[]
  loading?: boolean
  error?: string
  onRetry?: () => Promise<void>
}

export default function Achievements({ id = 'achievements', achievements = achievementData, loading, error, onRetry }: AchievementsProps) {
  const headingId = useId()
  const shouldReduceMotion = useReducedMotion()
  const publishedAchievements = achievements
    .filter((achievement) => achievement.isPublished)
    .sort((a, b) => b.year - a.year)
  const entrance = {
    initial: shouldReduceMotion ? false as const : { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: shouldReduceMotion ? 0 : 0.35, ease: 'easeOut' as const },
  }

  return (
    <section className="achievements" id={id} aria-labelledby={headingId} aria-busy={loading} tabIndex={-1}>
      <div className="container achievements__inner">
        <motion.div className="achievements__header" {...entrance}>
          <p className="achievements__eyebrow">Milestones</p>
          <h2 className="achievements__title" id={headingId}>Achievements</h2>
        </motion.div>

        {(loading || error) && <div className="content-feedback"><p role={error ? 'alert' : 'status'}>{error || 'Loading achievements…'}</p>{error && onRetry && <button className="content-retry" type="button" onClick={() => void onRetry()} aria-label="Retry loading achievements">Try again</button>}</div>}
        {!loading && !error && !publishedAchievements.length && <p>No published achievements yet.</p>}
        <ol className="achievements__timeline">
          {publishedAchievements.map(({ id: achievementId, year, event, title, description, result, team, division }, index) => (
            <motion.li
              className="achievements__entry"
              key={achievementId}
              data-achievement={achievementId}
              {...entrance}
              transition={{ ...entrance.transition, delay: shouldReduceMotion ? 0 : index * 0.06 }}
            >
              <span className="achievements__marker" aria-hidden="true" />
              <time className="achievements__year" dateTime={String(year)}>
                <CalendarDays size={16} strokeWidth={1.5} aria-hidden="true" />
                {year}
              </time>

              <article className="achievements__card surface surface--glass" aria-labelledby={`${headingId}-${achievementId}`}>
                <div className="achievements__card-header">
                  <h3 className="achievements__event" id={`${headingId}-${achievementId}`}>{title || event}</h3>
                  <span className="achievements__result">
                    <Flag size={15} strokeWidth={1.5} aria-hidden="true" />
                    {result}
                  </span>
                </div>
                {description && <p className="achievements__description">{description}</p>}

                {(team || division) && (
                  <dl className="achievements__details">
                    {team && (
                      <div className="achievements__detail">
                        <dt><UsersRound size={16} strokeWidth={1.5} aria-hidden="true" />Team</dt>
                        <dd>{team}</dd>
                      </div>
                    )}
                    {division && (
                      <div className="achievements__detail">
                        <dt><MapPin size={16} strokeWidth={1.5} aria-hidden="true" />Division</dt>
                        <dd>{division}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </article>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
