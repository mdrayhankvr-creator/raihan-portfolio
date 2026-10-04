import { useCallback, useEffect, useRef, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import Admin from '../../pages/Admin'
import AdminLogin from '../../pages/AdminLogin'
import { authAPI } from '../../lib/auth'
import type { AdminSession } from '../../lib/auth'
import { APIError, apiErrorMessage, sessionExpiredEvent } from '../../lib/api'

function destination(login: boolean) { return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/admin${login ? '/login' : ''}` }

export default function AdminAccess({ loginPage }: { loginPage: boolean }) {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [logoutPending, setLogoutPending] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const requestRef = useRef<AbortController | null>(null)
  const signingOut = useRef(false)
  const expire = useCallback(() => {
    requestRef.current?.abort()
    setSession(null)
    setChecking(false)
    if (!loginPage) window.location.replace(destination(true))
  }, [loginPage])
  const check = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setError('')
    try {
      const result = await authAPI.me(controller.signal)
      if (controller.signal.aborted || signingOut.current) return
      if (Date.parse(result.expiresAt) <= Date.now()) { expire(); return }
      if (loginPage) window.location.replace(destination(false))
      else setSession(result)
    } catch (cause) {
      if (controller.signal.aborted) return
      if (cause instanceof APIError && cause.status === 401) expire()
      else { setSession(null); setError(apiErrorMessage(cause)) }
    } finally { if (!controller.signal.aborted) setChecking(false) }
  }, [expire, loginPage])

  useEffect(() => { void check(); return () => requestRef.current?.abort() }, [check])
  useEffect(() => {
    if (!session) return
    const timer = window.setTimeout(expire, Math.max(0, Date.parse(session.expiresAt) - Date.now()))
    const refresh = () => { if (document.visibilityState === 'visible' && !signingOut.current) void check() }
    const interval = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener(sessionExpiredEvent, expire)
    return () => { window.clearTimeout(timer); window.clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); window.removeEventListener(sessionExpiredEvent, expire) }
  }, [session, check, expire])

  const logout = async () => {
    if (signingOut.current) return
    signingOut.current = true
    requestRef.current?.abort()
    setLogoutPending(true)
    setLogoutError('')
    try { await authAPI.logout(); setSession(null); window.location.replace(destination(true)) }
    catch (cause) { setLogoutError(apiErrorMessage(cause)); signingOut.current = false; setLogoutPending(false) }
  }

  if (checking || error || (!session && !loginPage)) return <main className="admin-access"><section className="admin-login surface surface--glass" aria-labelledby="access-title"><LockKeyhole className="admin-login__icon" aria-hidden="true" /><h1 id="access-title">Admin workspace</h1>{error ? <><p className="admin-form__error" role="alert">{error}</p><button className="admin-button" onClick={() => { setChecking(true); void check() }} type="button">Retry connection</button></> : <p role="status">Checking your session…</p>}<a className="admin-login__back" href={import.meta.env.BASE_URL}>Back to portfolio</a></section></main>
  if (loginPage) return <AdminLogin onSuccess={() => window.location.replace(destination(false))} />
  return session && <Admin session={session} onLogout={logout} logoutPending={logoutPending} logoutError={logoutError} />
}
