import { useState, type FormEvent } from 'react'
import { demoPassword, demoUsers, type AuthSession } from './auth'
import './auth.css'

export function AuthPage({ onLogin }: { onLogin: (session: AuthSession) => void }) {
  const [account, setAccount] = useState(demoUsers[0].user.email)
  const [email, setEmail] = useState(demoUsers[0].user.email)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const session = demoUsers.find(item => item.user.email.toLowerCase() === email.trim().toLowerCase())
    if (!session || password !== demoPassword) {
      setError('Compte de démonstration ou mot de passe incorrect.')
      return
    }
    onLogin(session)
  }

  return <main className="auth-screen"><div className="auth-card">
    <div className="auth-brand"><span>✚</span><div><b>MediHub</b><small>ESPACE DU PERSONNEL</small></div></div>
    <div className="auth-heading"><span className="eyebrow">ACCÈS SÉCURISÉ · DÉMONSTRATION</span><h1>Connexion du personnel</h1><p>Connectez-vous à votre espace selon votre rôle et votre établissement.</p></div>
    <div className="demo-callout"><b>Mode frontend avant connexion au backend</b><span>Ces profils servent à prévisualiser les tableaux de bord et les menus. Ils ne constituent pas une authentification sécurisée.</span></div>
    <form className="auth-form" onSubmit={submit}>
      <label>Profil de démonstration<select value={account} onChange={event => { setAccount(event.target.value); setEmail(event.target.value); setError('') }}>{demoUsers.map(item => <option key={item.user.id} value={item.user.email}>{item.user.role} · {item.facility.name}</option>)}</select></label>
      <label>Adresse e-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="username" /></label>
      <label>Mot de passe<input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Mot de passe de démonstration" required autoComplete="current-password" /></label>
      <small className="auth-hint">Mot de passe commun aux profils de démonstration : <b>{demoPassword}</b></small>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" type="submit">Se connecter <span>→</span></button>
    </form>
    <p className="auth-privacy">Les permissions présentées sont simulées côté frontend. En production, le backend devra authentifier le compte et contrôler chaque accès aux données.</p>
    <footer>© 2026 MediHub · Hôpital Kira · Prototype frontend</footer>
  </div></main>
}
