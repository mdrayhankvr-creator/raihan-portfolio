import type { ReactNode } from 'react'
import { SquareTerminal } from 'lucide-react'
import './PageState.css'

type PageStateProps = { title: string; description: string; label?: string; loading?: boolean; children?: ReactNode }

export default function PageState({ title, description, label = 'Portfolio', loading, children }: PageStateProps) {
  return <main className="page-state">
    <section className="page-state__card surface surface--glass" aria-labelledby="page-state-title">
      <span className="page-state__icon" aria-hidden="true"><SquareTerminal size={27} strokeWidth={1.5} /></span>
      <p className="page-state__label">{label}</p>
      <h1 id="page-state-title">{title}</h1>
      <p className="page-state__description" role={loading ? 'status' : undefined}>{description}</p>
      {children && <div className="page-state__actions">{children}</div>}
    </section>
  </main>
}
