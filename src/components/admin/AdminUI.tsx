import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export function AdminStatCard({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <div className="admin-stat surface surface--glass">
      <span className="admin-stat__icon" aria-hidden="true"><Icon size={21} strokeWidth={1.5} /></span>
      <p className="admin-stat__value">{value}</p>
      <p className="admin-stat__label">{label}</p>
    </div>
  )
}

export function PublicationBadge({ published }: { published: boolean }) {
  return <span className={`admin-badge ${published ? 'admin-badge--published' : ''}`}>{published ? 'Published' : 'Unpublished'}</span>
}

type RecordActionsProps = {
  title: string
  published: boolean
  disabled?: boolean
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: () => void
}

export function RecordActions({ title, published, disabled, onEdit, onDelete, onTogglePublish }: RecordActionsProps) {
  const PublishIcon = published ? EyeOff : Eye
  return (
    <div className="admin-record__actions">
      <button className="admin-button" type="button" disabled={disabled} onClick={onEdit} aria-label={`Edit ${title}`}>
        <Pencil size={15} aria-hidden="true" />Edit
      </button>
      <button className="admin-button" type="button" disabled={disabled} onClick={onTogglePublish} aria-label={`${published ? 'Unpublish' : 'Publish'} ${title}`}>
        <PublishIcon size={15} aria-hidden="true" />{published ? 'Unpublish' : 'Publish'}
      </button>
      <button className="admin-button admin-button--danger" type="button" disabled={disabled} onClick={onDelete} aria-label={`Delete ${title}`}>
        <Trash2 size={15} aria-hidden="true" />Delete
      </button>
    </div>
  )
}
