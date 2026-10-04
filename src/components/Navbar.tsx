import { useEffect, useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Menu, SquareTerminal, X } from 'lucide-react'
import './Navbar.css'

const navigationLinks = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Skills', href: '#skills' },
  { label: 'Projects', href: '#projects' },
  { label: 'Research', href: '#research' },
  { label: 'Achievements', href: '#achievements' },
  { label: 'Contact', href: '#contact' },
] as const

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuId = useId()
  const headerRef = useRef<HTMLElement>(null)
  const brandRef = useRef<HTMLAnchorElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const mobileControlHadFocus = useRef(false)
  const shouldReduceMotion = useReducedMotion()

  const closeMenu = () => setIsMenuOpen(false)

  const handleMobileNavigate = () => {
    setIsMenuOpen(false)
    toggleRef.current?.focus()
  }

  useEffect(() => {
    // Keep this query aligned with the desktop breakpoint in Navbar.css.
    const desktopQuery = window.matchMedia('(min-width: 64rem)')

    const handleDesktopChange = (event: MediaQueryListEvent) => {
      if (!event.matches) return

      const focusedElement = document.activeElement
      // Remember focus before desktop CSS hides a mobile link or the toggle.
      const focusWasOnMobileControl = mobileControlHadFocus.current
        || focusedElement === toggleRef.current
        || mobileMenuRef.current?.contains(focusedElement)

      setIsMenuOpen(false)

      if (focusWasOnMobileControl) {
        brandRef.current?.focus()
      }
    }

    const handleOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        mobileControlHadFocus.current = false
        setIsMenuOpen(false)
      }
    }

    desktopQuery.addEventListener('change', handleDesktopChange)
    document.addEventListener('pointerdown', handleOutsidePointer)

    return () => {
      desktopQuery.removeEventListener('change', handleDesktopChange)
      document.removeEventListener('pointerdown', handleOutsidePointer)
    }
  }, [])

  useEffect(() => {
    if (!isMenuOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      event.preventDefault()
      setIsMenuOpen(false)
      toggleRef.current?.focus()
    }

    const handleOutsideInteraction = (event: Event) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('focusin', handleOutsideInteraction)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('focusin', handleOutsideInteraction)
    }
  }, [isMenuOpen])

  return (
    <header
      className="navbar"
      ref={headerRef}
      onFocusCapture={(event) => {
        mobileControlHadFocus.current = event.target === toggleRef.current
          || Boolean(mobileMenuRef.current?.contains(event.target))
      }}
      onBlurCapture={(event) => {
        // A null destination can mean CSS hid the focused mobile control.
        if (event.relatedTarget) mobileControlHadFocus.current = false
      }}
    >
      <nav className="container navbar__container" aria-label="Primary navigation">
        <div className="navbar__bar">
          <a className="navbar__brand" href="#home" ref={brandRef} onClick={closeMenu}>
            <span className="navbar__brand-mark" aria-hidden="true">
              <SquareTerminal size={20} strokeWidth={1.75} />
            </span>
            <span>Md. Raihan Chowdhury</span>
          </a>

          <ul className="navbar__desktop-links">
            {navigationLinks.map(({ label, href }) => (
              <li key={href}>
                <a className="navbar__link" href={href}>{label}</a>
              </li>
            ))}
          </ul>

          <button
            className="navbar__toggle"
            type="button"
            ref={toggleRef}
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMenuOpen}
            aria-controls={menuId}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen
              ? <X size={22} strokeWidth={1.75} aria-hidden="true" />
              : <Menu size={22} strokeWidth={1.75} aria-hidden="true" />}
          </button>
        </div>

        <div
          className="navbar__mobile-menu"
          id={menuId}
          ref={mobileMenuRef}
          hidden={!isMenuOpen}
        >
          {/* Entry-only motion keeps closed links out of the tab order immediately. */}
          {isMenuOpen && (
            <motion.ul
              className="navbar__mobile-links"
              initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: 'easeOut' }}
            >
              {navigationLinks.map(({ label, href }) => (
                <li key={href}>
                  <a className="navbar__link" href={href} onClick={handleMobileNavigate}>{label}</a>
                </li>
              ))}
            </motion.ul>
          )}
        </div>
      </nav>
    </header>
  )
}
