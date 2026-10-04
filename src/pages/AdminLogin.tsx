import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, LockKeyhole, LogIn } from 'lucide-react'
import { authAPI } from '../lib/auth'
import { apiErrorMessage } from '../lib/api'
import './Admin.css'
import './AdminLogin.css'

export default function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const reduceMotion = useReducedMotion()

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try { await authAPI.login(username, password); setPassword(''); onSuccess() }
    catch (cause) { setPassword(''); setError(apiErrorMessage(cause)) }
    finally { submitting.current = false; setBusy(false) }
  }

  return <main className="admin-access">
    <motion.section className="admin-login surface surface--glass" aria-labelledby="login-title" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.22 }}>
      <span className="admin-login__icon"><LockKeyhole size={26} aria-hidden="true" /></span>
      <p className="admin-login__eyebrow">Portfolio workspace</p>
      <h1 id="login-title">Admin sign in</h1>
      <p className="admin-login__intro">Manage projects and achievements for Md. Raihan Chowdhury.</p>
      <form className="admin-form admin-login__form" onSubmit={submit} aria-busy={busy}>
        <div className="admin-form__field"><label htmlFor="admin-username">Username</label><input id="admin-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={64} value={username} onChange={(event) => setUsername(event.target.value)} disabled={busy} /></div>
        <div className="admin-form__field"><label htmlFor="admin-password">Password</label><input id="admin-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /></div>
        {error && <p className="admin-form__error" role="alert">{error}</p>}
        <button className="admin-button admin-button--primary" type="submit" disabled={busy}><LogIn size={18} aria-hidden="true" />{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="admin-login__note">Access requires the admin account created through the backend setup command.</p>
      <a className="admin-login__back" href={import.meta.env.BASE_URL}><ArrowLeft size={16} aria-hidden="true" />Back to portfolio</a>
    </motion.section>
  </main>
}
