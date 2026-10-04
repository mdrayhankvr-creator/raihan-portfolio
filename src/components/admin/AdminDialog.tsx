import { useEffect, useId, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'

type AdminDialogProps = {
  title: string
  children: ReactNode
  onClose: () => void
  fallbackFocus: RefObject<HTMLHeadingElement | null>
  busy?: boolean
}

export default function AdminDialog({ title, children, onClose, fallbackFocus, busy }: AdminDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const descriptionId = useId()
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    dialog?.showModal()
    dialog?.querySelector<HTMLElement>('[data-initial-focus]')?.focus()
    document.body.style.overflow = 'hidden'

    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
      else fallbackFocus.current?.focus({ preventScroll: true })
    }
  }, [fallbackFocus])

  return (
    <dialog
      className="admin-dialog"
      ref={dialogRef}
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')].filter((element) => !element.matches(':disabled') && element.tabIndex >= 0 && element.getClientRects().length > 0)
        const first = controls[0]
        const last = controls.at(-1)
        if (!first) { event.preventDefault(); event.currentTarget.focus(); return }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const box = event.currentTarget.getBoundingClientRect()
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
      }}
    >
      <motion.div
        className="admin-dialog__content"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
      >
        <div className="admin-dialog__header">
          <h2 id={headingId}>{title}</h2>
          <button className="admin-button admin-dialog__close" type="button" disabled={busy} onClick={onClose} aria-label="Close dialog"><X size={20} aria-hidden="true" /></button>
        </div>
        <p className="admin-dialog__notice" id={descriptionId}>Changes are saved through the Go API to MongoDB using your authenticated admin session.</p>
        {children}
      </motion.div>
    </dialog>
  )
}
