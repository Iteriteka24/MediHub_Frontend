import { useState, type FormEvent } from 'react'
import { loginStaff } from './api'
import type { AuthSession } from './auth'
import './auth.css'

export function AuthPage({ onLogin }: { onLogin: (session: AuthSession) => void }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      onLogin(await loginStaff(identifier.trim(), password))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Connexion impossible. Vérifiez vos identifiants et le serveur.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="auth-screen"><div className="auth-card">
    <div className="auth-brand"><span>✚</span><div><b>MediHub</b><small>ESPACE DU PERSONNEL</small></div></div>
    <div className="auth-heading"><span className="eyebrow">ACCÈS SÉCURISÉ</span><h1>Connexion du personnel</h1><p>Connectez-vous avec l’identifiant fourni par votre établissement.</p></div>
    <div className="demo-callout"><b>Connexion au serveur MediHub</b><span>Votre session est gérée par le serveur. Les autorisations sont vérifiées par l’API.</span></div>
    <form className="auth-form" onSubmit={submit}>
      <label>Identifiant de connexion<input value={identifier} onChange={event => setIdentifier(event.target.value)} required autoComplete="username" /></label>
      <label>Mot de passe<input type="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'} <span>→</span></button>
    </form>
    <p className="auth-privacy">La connexion utilise une session sécurisée et les permissions attribuées à votre compte dans MediHub.</p>
    <footer>© 2026 MediHub</footer>
  </div></main>
}
