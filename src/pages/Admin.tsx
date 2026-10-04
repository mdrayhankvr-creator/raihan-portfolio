import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, CheckCircle2, FolderKanban, LayoutDashboard, ListChecks, LogOut, Plus, ShieldCheck, Terminal, Trophy, Workflow } from 'lucide-react'
import type { AdminSession } from '../lib/auth'
import type { Project } from '../data/projects'
import type { Achievement } from '../data/achievements'
import { useAdminContent } from '../hooks/useAdminContent'
import { publicAPIConfigured } from '../lib/api'
import AdminDialog from '../components/admin/AdminDialog'
import { AchievementForm, ProjectForm } from '../components/admin/AdminForms'
import type { AchievementDraft, ProjectDraft } from '../components/admin/AdminForms'
import { AdminStatCard, PublicationBadge, RecordActions } from '../components/admin/AdminUI'
import './Admin.css'

const navigation = [
  { id: 'overview', label: 'Overview', title: 'Dashboard overview', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', title: 'Projects', icon: FolderKanban },
  { id: 'achievements', label: 'Achievements', title: 'Achievements', icon: Trophy },
  { id: 'content', label: 'Content status', title: 'Content status', icon: ListChecks },
] as const
type View = typeof navigation[number]['id']
type Editor = { kind: 'project'; record?: Project } | { kind: 'achievement'; record?: Achievement }
type DeleteTarget = { kind: 'project' | 'achievement'; id: string; title: string }
const publicSections = ['Hero', 'About', 'Skills', 'Projects', 'AI & Research', 'Achievements', 'Contact']

type AdminProps = { session: AdminSession; onLogout: () => Promise<void>; logoutPending: boolean; logoutError: string }

export default function Admin({ session, onLogout, logoutPending, logoutError }: AdminProps) {
  const [view, setView] = useState<View>('overview')
  const content = useAdminContent()
  const { projects, achievements, loading, loadError, actionError } = content
  const pending = content.pending || logoutPending
  const [editor, setEditor] = useState<Editor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [feedback, setFeedback] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const reduceMotion = useReducedMotion()
  const currentView = navigation.find((item) => item.id === view)!
  const completed = projects.filter((project) => project.status === 'Completed').length
  const publishedProjects = projects.filter((project) => project.isPublished).length
  const publishedAchievements = achievements.filter((achievement) => achievement.isPublished).length

  const changeView = (nextView: View) => {
    setView(nextView)
    requestAnimationFrame(() => headingRef.current?.focus())
  }
  const openEditor = (next: Editor) => { content.clearActionError(); setFeedback(''); setEditor(next) }
  const openDelete = (next: DeleteTarget) => { content.clearActionError(); setFeedback(''); setDeleteTarget(next) }
  const closeEditor = () => { if (!pending) setEditor(null) }
  const closeDelete = () => { if (!pending) setDeleteTarget(null) }
  const applyProject = async (draft: ProjectDraft) => {
    const id = editor?.kind === 'project' ? editor.record?.id : undefined
    if (await content.saveProject(draft, id)) {
      setEditor(null)
      setFeedback(`${draft.title} ${id ? 'updated' : 'added'} in MongoDB.`)
    }
  }
  const applyAchievement = async (draft: AchievementDraft) => {
    const id = editor?.kind === 'achievement' ? editor.record?.id : undefined
    if (await content.saveAchievement(draft, id)) {
      setEditor(null)
      setFeedback(`${draft.event} ${id ? 'updated' : 'added'} in MongoDB.`)
    }
  }
  const deleteRecord = async () => {
    if (!deleteTarget) return
    const success = deleteTarget.kind === 'project' ? await content.deleteProject(deleteTarget.id) : await content.deleteAchievement(deleteTarget.id)
    if (success) { setFeedback(`${deleteTarget.title} deleted from MongoDB.`); setDeleteTarget(null) }
  }

  return (
    <div className="admin-shell">
      <a className="admin-skip" href="#admin-content">Skip to admin content</a>
      <aside className="admin-sidebar">
        <div className="admin-brand"><span><Terminal size={22} aria-hidden="true" /></span><div><strong>Portfolio workspace</strong><p>Md. Raihan Chowdhury</p></div></div>
        <p className="admin-sidebar__label">Manage content</p>
        <nav className="admin-nav" aria-label="Admin navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => changeView(id)} aria-current={view === id ? 'page' : undefined} disabled={pending}>
              <Icon size={18} aria-hidden="true" />{label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar__bottom"><span className="admin-badge">API-backed content</span><a href={import.meta.env.BASE_URL}>View portfolio <ArrowUpRight size={16} aria-hidden="true" /></a></div>
      </aside>

      <main className="admin-main" id="admin-content" tabIndex={-1}>
        <header className="admin-header">
          <div className="admin-header__eyebrow"><span>Portfolio / Admin</span><span className="admin-badge admin-badge--published">Authenticated admin</span></div>
          <h1 ref={headingRef} tabIndex={-1}>{currentView.title}</h1>
          <p>Manage your portfolio content through the Go API.</p>
          <div className="admin-session"><span>Signed in as {session.admin.username}</span><button className="admin-button" type="button" disabled={pending} onClick={() => void onLogout()}><LogOut size={16} aria-hidden="true" />{logoutPending ? 'Signing out…' : 'Sign out'}</button></div>
        </header>
        <div className="admin-notice surface"><ShieldCheck size={20} aria-hidden="true" /><p><strong>Admin session active.</strong> The API verifies your session before saving changes to MongoDB. This session expires at <time dateTime={session.expiresAt}>{new Date(session.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>.</p></div>
        {logoutError && <p className="admin-api-error" role="alert">{logoutError}</p>}
        <p className="admin-feedback" role="status">{feedback}</p>
        {loading && <p className="admin-empty" role="status">Loading projects and achievements…</p>}
        {loadError && <div className="admin-api-error surface" role="alert"><p>{loadError}</p><button className="admin-button" type="button" onClick={() => void content.reload()}>Retry loading</button></div>}
        {actionError && !editor && !deleteTarget && <p className="admin-api-error" role="alert">{actionError}</p>}

        {!loading && !loadError && <motion.div className="admin-view" key={view} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }}>
          {view === 'overview' && <>
            <div className="admin-stats">
              <AdminStatCard label="Total Projects" value={projects.length} icon={FolderKanban} />
              <AdminStatCard label="Completed Projects" value={completed} icon={CheckCircle2} />
              <AdminStatCard label="In Progress Projects" value={projects.length - completed} icon={Workflow} />
              <AdminStatCard label="Achievements" value={achievements.length} icon={Trophy} />
            </div>
            <div className="admin-overview-grid">
              <section className="admin-panel surface surface--glass" aria-labelledby="admin-project-summary">
                <div className="admin-panel__heading"><h2 id="admin-project-summary">Projects at a glance</h2><button className="admin-button" type="button" onClick={() => changeView('projects')}>Manage projects</button></div>
                <ul className="admin-summary-list">{projects.map((project) => <li key={project.id}><div><strong>{project.title}</strong><p>{project.status}</p></div><PublicationBadge published={project.isPublished} /></li>)}</ul>
                {!projects.length && <p className="admin-empty">No projects yet.</p>}
              </section>
              <section className="admin-panel surface surface--glass" aria-labelledby="admin-foundation-status">
                <h2 id="admin-foundation-status">Foundation status</h2>
                <dl className="admin-status-list"><div><dt>Content management</dt><dd>Go API</dd></div><div><dt>Persistence</dt><dd>MongoDB</dd></div><div><dt>Authentication</dt><dd>Cookie session</dd></div><div><dt>Database reads</dt><dd>Connected</dd></div><div><dt>Public content source</dt><dd>{publicAPIConfigured ? 'MongoDB' : 'Bundled content'}</dd></div></dl>
                <p className="admin-panel__note">Unpublished records and content changes require an authenticated admin session.</p>
                {!publicAPIConfigured && <p className="admin-panel__note">The public page is using bundled content. Configure its API connection to display saved changes.</p>}
              </section>
            </div>
          </>}

          {view === 'projects' && <section aria-label="Projects management">
            <div className="admin-toolbar"><p>{projects.length} projects in MongoDB</p><button className="admin-button admin-button--primary" type="button" disabled={pending} onClick={() => openEditor({ kind: 'project' })}><Plus size={18} aria-hidden="true" />Add Project</button></div>
            <ul className="admin-records">{projects.map((project) => <li key={project.id}>
              <article className="admin-record surface surface--glass" data-project={project.id}>
                <div className="admin-record__body"><div className="admin-record__heading"><h2>{project.title}</h2><PublicationBadge published={project.isPublished} /></div><div className="admin-record__meta"><span className={`admin-badge ${project.status === 'Completed' ? 'admin-badge--published' : 'admin-badge--pending'}`}>{project.status}</span><span>{project.category}</span></div><p>{project.description}</p>
                  {project.stack && <div className="admin-technologies"><p>{project.stack.label}</p><ul>{project.stack.technologies.map((technology) => <li key={technology}>{technology}</li>)}</ul></div>}
                </div>
                <RecordActions title={project.title} published={project.isPublished} disabled={pending} onEdit={() => openEditor({ kind: 'project', record: project })} onDelete={() => openDelete({ kind: 'project', id: project.id, title: project.title })} onTogglePublish={async () => {
                  setFeedback('')
                  if (await content.saveProject({ ...project, isPublished: !project.isPublished }, project.id)) setFeedback(`${project.title} ${project.isPublished ? 'unpublished' : 'published'} in MongoDB.`)
                }} />
              </article>
            </li>)}</ul>
            {!projects.length && <p className="admin-empty surface">No projects yet. Add a project or import the existing portfolio records using the seed command.</p>}
          </section>}

          {view === 'achievements' && <section aria-label="Achievements management">
            <div className="admin-toolbar"><p>{achievements.length} achievements in MongoDB</p><button className="admin-button admin-button--primary" type="button" disabled={pending} onClick={() => openEditor({ kind: 'achievement' })}><Plus size={18} aria-hidden="true" />Add Achievement</button></div>
            <ul className="admin-records">{achievements.map((achievement) => <li key={achievement.id}>
              <article className="admin-record surface surface--glass" data-achievement={achievement.id}>
                <div className="admin-record__body"><div className="admin-record__heading"><h2>{achievement.event}</h2><PublicationBadge published={achievement.isPublished} /></div><div className="admin-record__meta"><span className="admin-badge admin-badge--year">{achievement.year}</span><span>{achievement.result}</span></div>
                  {(achievement.team || achievement.division) && <dl className="admin-record__details">{achievement.team && <div><dt>Team</dt><dd>{achievement.team}</dd></div>}{achievement.division && <div><dt>Division</dt><dd>{achievement.division}</dd></div>}</dl>}
                  {achievement.description && <p>{achievement.description}</p>}
                </div>
                <RecordActions title={achievement.event} published={achievement.isPublished} disabled={pending} onEdit={() => openEditor({ kind: 'achievement', record: achievement })} onDelete={() => openDelete({ kind: 'achievement', id: achievement.id, title: achievement.event })} onTogglePublish={async () => {
                  setFeedback('')
                  if (await content.saveAchievement({ ...achievement, isPublished: !achievement.isPublished }, achievement.id)) setFeedback(`${achievement.event} ${achievement.isPublished ? 'unpublished' : 'published'} in MongoDB.`)
                }} />
              </article>
            </li>)}</ul>
            {!achievements.length && <p className="admin-empty surface">No achievements yet. Add an achievement or import the confirmed portfolio records using the seed command.</p>}
          </section>}

          {view === 'content' && <div className="admin-overview-grid">
            <section className="admin-panel surface surface--glass" aria-labelledby="admin-publication-status"><h2 id="admin-publication-status">Publication status</h2><p className="admin-panel__note">Saved publication flags control content in API-backed public builds.</p><dl className="admin-status-list"><div><dt>Projects · published</dt><dd>{publishedProjects}</dd></div><div><dt>Projects · unpublished</dt><dd>{projects.length - publishedProjects}</dd></div><div><dt>Achievements · published</dt><dd>{publishedAchievements}</dd></div><div><dt>Achievements · unpublished</dt><dd>{achievements.length - publishedAchievements}</dd></div></dl></section>
            <section className="admin-panel surface surface--glass" aria-labelledby="admin-section-status"><h2 id="admin-section-status">Public section status</h2><ul className="admin-summary-list">{publicSections.map((section) => <li key={section}><span>{section}</span><span className="admin-badge admin-badge--published">Implemented</span></li>)}<li><span>Travel</span><span className="admin-badge">Postponed</span></li></ul></section>
          </div>}
        </motion.div>}
      </main>

      {editor && <AdminDialog key={`${editor.kind}-${editor.record?.id ?? 'new'}`} title={`${editor.record ? 'Edit' : 'Add'} ${editor.kind === 'project' ? 'Project' : 'Achievement'}`} onClose={closeEditor} busy={pending} fallbackFocus={headingRef}>
        {editor.kind === 'project' ? <ProjectForm project={editor.record} onApply={applyProject} onCancel={closeEditor} busy={pending} apiError={actionError} /> : <AchievementForm achievement={editor.record} onApply={applyAchievement} onCancel={closeEditor} busy={pending} apiError={actionError} />}
      </AdminDialog>}
      {deleteTarget && <AdminDialog title={`Delete ${deleteTarget.kind}?`} onClose={closeDelete} busy={pending} fallbackFocus={headingRef}>
        <p className="admin-delete-message">Permanently delete <strong>{deleteTarget.title}</strong> from MongoDB? It will also be removed from the API-backed public portfolio.</p>
        {actionError && <p className="admin-form__error" role="alert">{actionError}</p>}
        <div className="admin-form__actions"><button className="admin-button" type="button" data-initial-focus disabled={pending} onClick={closeDelete}>Cancel</button><button className="admin-button admin-button--danger" type="button" disabled={pending} onClick={() => void deleteRecord()}>{pending ? 'Deleting…' : 'Delete permanently'}</button></div>
      </AdminDialog>}
    </div>
  )
}
