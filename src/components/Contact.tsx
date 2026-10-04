import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Camera, GitFork, Mail, MessageCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import './Contact.css'

type ContactProps = {
  id?: string
}

type ContactOption = {
  label: string
  value: string
  href: string
  icon: LucideIcon
  action: string
  ariaLabel: string
  external: boolean
}

const professionalContacts: readonly ContactOption[] = [
  {
    label: 'Email',
    value: 'mdrayhankvr@gmail.com',
    href: 'mailto:mdrayhankvr@gmail.com',
    icon: Mail,
    action: 'Send email',
    ariaLabel: 'Email Md. Raihan Chowdhury at mdrayhankvr@gmail.com (opens your email client)',
    external: false,
  },
  {
    label: 'GitHub',
    value: '@mdrayhankvr-creator',
    href: 'https://github.com/mdrayhankvr-creator',
    icon: GitFork,
    action: 'View profile',
    ariaLabel: 'GitHub: mdrayhankvr-creator (opens in a new tab)',
    external: true,
  },
  {
    label: 'LinkedIn',
    value: 'Md. Raihan Chowdhury',
    href: 'https://linkedin.com/in/md-raihan-chowdhury-13777b381/',
    icon: BriefcaseBusiness,
    action: 'View profile',
    ariaLabel: 'LinkedIn: Md. Raihan Chowdhury (opens in a new tab)',
    external: true,
  },
  {
    label: 'WhatsApp',
    value: '01873034022',
    // Bangladesh country code 880 + local number without its leading zero.
    href: 'https://wa.me/8801873034022',
    icon: MessageCircle,
    action: 'Start a chat',
    ariaLabel: 'WhatsApp: 01873034022 (opens in a new tab)',
    external: true,
  },
]

export default function Contact({ id = 'contact' }: ContactProps) {
  const headingId = useId()
  const shouldReduceMotion = useReducedMotion()
  const entrance = {
    initial: shouldReduceMotion ? false as const : { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: shouldReduceMotion ? 0 : 0.35, ease: 'easeOut' as const },
  }

  return (
    <section className="contact" id={id} aria-labelledby={headingId} tabIndex={-1}>
      <div className="container contact__inner">
        <motion.div className="contact__header" {...entrance}>
          <p className="contact__eyebrow">Contact</p>
          <h2 className="contact__title" id={headingId}>Let's Connect</h2>
          <p className="contact__intro">Reach me by email or connect through the links below.</p>
        </motion.div>

        <div className="contact__options">
          <ul className="contact__primary" aria-label="Professional contact options">
            {professionalContacts.map(({ label, value, href, icon: Icon, action, ariaLabel, external }, index) => (
              <motion.li
                className="contact__entry"
                key={label}
                {...entrance}
                transition={{ ...entrance.transition, delay: shouldReduceMotion ? 0 : index * 0.05 }}
              >
                <a
                  className="contact__card surface surface--glass"
                  href={href}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noopener noreferrer' : undefined}
                  aria-label={ariaLabel}
                  data-contact={label}
                >
                  <span className="contact__icon" aria-hidden="true"><Icon size={23} strokeWidth={1.5} /></span>
                  <span className="contact__label">{label}</span>
                  <span className="contact__value">{value}</span>
                  <span className="contact__action">
                    {action}
                    {external
                      ? <ArrowUpRight className="contact__arrow" size={17} strokeWidth={1.5} aria-hidden="true" />
                      : <ArrowRight className="contact__arrow" size={17} strokeWidth={1.5} aria-hidden="true" />}
                  </span>
                </a>
              </motion.li>
            ))}
          </ul>

          <motion.div className="contact__secondary" {...entrance}>
            <a
              className="contact__secondary-link surface surface--glass"
              href="https://www.instagram.com/ray_mellow_/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram: ray_mellow_ (opens in a new tab)"
              data-contact="Instagram"
            >
              <Camera size={20} strokeWidth={1.5} aria-hidden="true" />
              <span className="contact__secondary-text">
                <span className="contact__secondary-label">Instagram</span>
                <span className="contact__secondary-value">@ray_mellow_</span>
              </span>
              <ArrowUpRight className="contact__arrow" size={17} strokeWidth={1.5} aria-hidden="true" />
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
