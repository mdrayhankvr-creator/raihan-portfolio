import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { Project } from '../../data/projects'
import type { Achievement } from '../../data/achievements'

export type ProjectDraft = Omit<Project, 'id'>
export type AchievementDraft = Omit<Achievement, 'id'>

type FormState = { busy?: boolean; apiError?: string }

function FormActions({ onCancel, busy }: { onCancel: () => void; busy?: boolean }) {
  return (
    <div className="admin-form__actions">
      <button className="admin-button" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
      <button className="admin-button admin-button--primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
    </div>
  )
}

export function ProjectForm({ project, onApply, onCancel, busy, apiError }: { project?: Project; onApply: (draft: ProjectDraft) => void; onCancel: () => void } & FormState) {
  const formId = useId()
  const [title, setTitle] = useState(project?.title ?? '')
  const [category, setCategory] = useState(project?.category ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [status, setStatus] = useState<Project['status']>(project?.status ?? 'In Progress')
  const [icon, setIcon] = useState<Project['icon']>(project?.icon ?? 'link')
  const [stackLabel, setStackLabel] = useState<NonNullable<Project['stack']>['label']>(project?.stack?.label ?? 'Technologies')
  const [technologies, setTechnologies] = useState(project?.stack?.technologies.join(', ') ?? '')
  const [isPublished, setIsPublished] = useState(project?.isPublished ?? false)
  const [error, setError] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    if (!title.trim() || !category.trim() || !description.trim()) {
      setError('Title, category, and description cannot be blank.')
      return
    }
    const tags = [...new Set(technologies.split(',').map((tag) => tag.trim()).filter(Boolean))]
    setError('')
    onApply({ title: title.trim(), category: category.trim(), description: description.trim(), status, icon, isPublished,
      ...(tags.length ? { stack: { label: stackLabel, technologies: tags } } : {}),
    })
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <div className="admin-form__field">
        <label htmlFor={`${formId}-title`}>Project title</label>
        <input disabled={busy} id={`${formId}-title`} name="title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={140} data-initial-focus />
      </div>
      <div className="admin-form__field">
        <label htmlFor={`${formId}-category`}>Category</label>
        <input disabled={busy} id={`${formId}-category`} name="category" value={category} onChange={(event) => setCategory(event.target.value)} required maxLength={100} />
      </div>
      <div className="admin-form__field admin-form__field--wide">
        <label htmlFor={`${formId}-description`}>Description</label>
        <textarea disabled={busy} id={`${formId}-description`} name="description" value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={1600} rows={3} />
      </div>
      <div className="admin-form__field">
        <label htmlFor={`${formId}-status`}>Completion status</label>
        <select disabled={busy} id={`${formId}-status`} name="status" value={status} onChange={(event) => setStatus(event.target.value as Project['status'])}>
          <option>In Progress</option><option>Completed</option>
        </select>
      </div>
      <div className="admin-form__field">
        <label htmlFor={`${formId}-icon`}>Card icon</label>
        <select disabled={busy} id={`${formId}-icon`} name="icon" value={icon} onChange={(event) => setIcon(event.target.value as Project['icon'])}>
          <option value="link">Service</option><option value="ai">AI systems</option><option value="dashboard">Dashboard</option>
        </select>
      </div>
      <div className="admin-form__field">
        <label htmlFor={`${formId}-stack-label`}>Technology label</label>
        <select disabled={busy} id={`${formId}-stack-label`} name="stackLabel" value={stackLabel} onChange={(event) => setStackLabel(event.target.value as NonNullable<Project['stack']>['label'])}>
          <option>Technologies</option><option>Proposed stack</option>
        </select>
      </div>
      <div className="admin-form__field">
        <label htmlFor={`${formId}-technologies`}>Technologies (optional)</label>
        <input disabled={busy} id={`${formId}-technologies`} name="technologies" value={technologies} onChange={(event) => setTechnologies(event.target.value)} maxLength={500} aria-describedby={`${formId}-technology-help`} />
        <p id={`${formId}-technology-help`}>Separate technology names with commas.</p>
      </div>
      <label className="admin-form__checkbox admin-form__field--wide">
        <input disabled={busy} name="isPublished" type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />Published on portfolio
      </label>
      {error && <p className="admin-form__error" role="alert">{error}</p>}
      {apiError && <p className="admin-form__error" role="alert">{apiError}</p>}
      <FormActions onCancel={onCancel} busy={busy} />
    </form>
  )
}

export function AchievementForm({ achievement, onApply, onCancel, busy, apiError }: { achievement?: Achievement; onApply: (draft: AchievementDraft) => void; onCancel: () => void } & FormState) {
  const formId = useId()
  const [eventName, setEventName] = useState(achievement?.event ?? '')
  const [title, setTitle] = useState(achievement?.title ?? '')
  const [description, setDescription] = useState(achievement?.description ?? '')
  const [year, setYear] = useState(achievement ? String(achievement.year) : '')
  const [result, setResult] = useState(achievement?.result ?? '')
  const [team, setTeam] = useState(achievement?.team ?? '')
  const [division, setDivision] = useState(achievement?.division ?? '')
  const [isPublished, setIsPublished] = useState(achievement?.isPublished ?? false)
  const [error, setError] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const parsedYear = Number(year)
    if (!eventName.trim() || !result.trim() || !Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 9999) {
      setError('Enter an event, a result, and a valid four-digit year.')
      return
    }
    setError('')
    onApply({ event: eventName.trim(), title: title.trim() || eventName.trim(), description: description.trim(), year: parsedYear, result: result.trim(), isPublished,
      ...(team.trim() ? { team: team.trim() } : {}), ...(division.trim() ? { division: division.trim() } : {}),
    })
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <div className="admin-form__field admin-form__field--wide">
        <label htmlFor={`${formId}-event`}>Event name</label>
        <input disabled={busy} id={`${formId}-event`} name="event" value={eventName} onChange={(event) => setEventName(event.target.value)} required maxLength={160} data-initial-focus />
      </div>
      <div className="admin-form__field admin-form__field--wide">
        <label htmlFor={`${formId}-title`}>Display title (optional)</label>
        <input disabled={busy} id={`${formId}-title`} name="title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} aria-describedby={`${formId}-title-help`} />
        <p id={`${formId}-title-help`}>Defaults to the event name.</p>
      </div>
      <div className="admin-form__field admin-form__field--wide">
        <label htmlFor={`${formId}-description`}>Description (optional)</label>
        <textarea disabled={busy} id={`${formId}-description`} name="description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1600} rows={3} />
      </div>
      <div className="admin-form__field">
        <label htmlFor={`${formId}-year`}>Year</label>
        <input disabled={busy} id={`${formId}-year`} name="year" type="number" min={1900} max={9999} step={1} value={year} onChange={(event) => setYear(event.target.value)} required />
      </div>
      <div className="admin-form__field">
        <label htmlFor={`${formId}-result`}>Result</label>
        <input disabled={busy} id={`${formId}-result`} name="result" value={result} onChange={(event) => setResult(event.target.value)} required maxLength={100} />
      </div>
      <div className="admin-form__field">
        <label htmlFor={`${formId}-team`}>Team (optional)</label>
        <input disabled={busy} id={`${formId}-team`} name="team" value={team} onChange={(event) => setTeam(event.target.value)} maxLength={100} />
      </div>
      <div className="admin-form__field">
        <label htmlFor={`${formId}-division`}>Division (optional)</label>
        <input disabled={busy} id={`${formId}-division`} name="division" value={division} onChange={(event) => setDivision(event.target.value)} maxLength={100} />
      </div>
      <label className="admin-form__checkbox admin-form__field--wide">
        <input disabled={busy} name="isPublished" type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />Published on portfolio
      </label>
      {error && <p className="admin-form__error" role="alert">{error}</p>}
      {apiError && <p className="admin-form__error" role="alert">{apiError}</p>}
      <FormActions onCancel={onCancel} busy={busy} />
    </form>
  )
}
