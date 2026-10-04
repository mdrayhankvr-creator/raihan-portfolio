import { useCallback, useEffect, useRef, useState } from 'react'
import { publicAPIConfigured } from '../lib/api'

// Static builds retain the existing portfolio. Configured API builds never
// substitute bundled records for failed reads or an intentionally empty list.
export function usePublicContent<T>(load: (signal?: AbortSignal, publishedOnly?: boolean) => Promise<T[]>, source: readonly T[]) {
  const [records, setRecords] = useState<readonly T[]>(publicAPIConfigured ? [] : source)
  const [loading, setLoading] = useState(publicAPIConfigured)
  const [error, setError] = useState('')
  const requestRef = useRef<AbortController | null>(null)
  const reload = useCallback(async () => {
    if (!publicAPIConfigured) return
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError('')
    setRecords([])
    try {
      const data = await load(controller.signal, true)
      if (!controller.signal.aborted) setRecords(data)
    } catch {
      if (!controller.signal.aborted) setError('Content is temporarily unavailable. Please try again later.')
    } finally { if (!controller.signal.aborted) setLoading(false) }
  }, [load])
  useEffect(() => { void reload(); return () => requestRef.current?.abort() }, [reload])
  return { records, loading, error, reload }
}
