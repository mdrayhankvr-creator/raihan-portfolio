import { useCallback, useEffect, useRef, useState } from 'react'
import { apiErrorMessage, contentAPI } from '../lib/api'
import type { Project } from '../data/projects'
import type { Achievement } from '../data/achievements'

export function useAdminContent() {
  const [projects, setProjects] = useState<readonly Project[]>([])
  const [achievements, setAchievements] = useState<readonly Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const actionInFlight = useRef(false)

  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setLoadError('')
    try {
      const [nextProjects, nextAchievements] = await Promise.all([contentAPI.projects(signal), contentAPI.achievements(signal)])
      if (!signal?.aborted) { setProjects(nextProjects); setAchievements(nextAchievements) }
    } catch (error) { if (!signal?.aborted) setLoadError(apiErrorMessage(error)) }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [])

  useEffect(() => { const controller = new AbortController(); void reload(controller.signal); return () => controller.abort() }, [reload])

  async function mutate<T>(operation: () => Promise<T>, apply: (record: T) => void) {
    if (actionInFlight.current) return false
    actionInFlight.current = true
    setPending(true)
    setActionError('')
    try { const record = await operation(); apply(record); return true }
    catch (error) { setActionError(apiErrorMessage(error)); return false }
    finally { actionInFlight.current = false; setPending(false) }
  }

  return { projects, achievements, loading, pending, loadError, actionError, clearActionError: () => setActionError(''), reload,
    saveProject: (draft: Omit<Project, 'id'>, id?: string) => mutate(() => contentAPI.saveProject(draft, id), (record) => setProjects((previous) => id ? previous.map((item) => item.id === id ? record : item) : [...previous, record])),
    saveAchievement: (draft: Omit<Achievement, 'id'>, id?: string) => mutate(() => contentAPI.saveAchievement(draft, id), (record) => setAchievements((previous) => id ? previous.map((item) => item.id === id ? record : item) : [...previous, record])),
    deleteProject: (id: string) => mutate(() => contentAPI.deleteProject(id), () => setProjects((previous) => previous.filter((item) => item.id !== id))),
    deleteAchievement: (id: string) => mutate(() => contentAPI.deleteAchievement(id), () => setAchievements((previous) => previous.filter((item) => item.id !== id))),
  }
}
