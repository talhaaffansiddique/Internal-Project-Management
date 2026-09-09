import { useEffect, useState } from 'react'
import './App.css'
import { useAuth } from './auth'
import Login from './pages/Login'
import { api } from './api'

type Health = { status: string; db: string; service: string; time: string }

export default function App() {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return <div className="login-wrap"><p className="muted">Loading…</p></div>
  }
  if (!user) {
    return <Login />
  }
  return <AuthedHome onLogout={logout} />
}

function AuthedHome({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth()
  const [health, setHealth] = useState<Health | null>(null)

  useEffect(() => {
    api<Health>('/health').then(setHealth).catch(() => setHealth(null))
  }, [])

  const initials = user!.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo">OP</span> OpsHub
        </div>
        <div className="who">
          <span className="avatar">{initials}</span>
          <div>
            <b>{user!.fullName}</b>
            <div className="muted small">
              {user!.roleNames.join(', ')} · {user!.primaryDepartment?.name ?? 'No department'}
            </div>
          </div>
          <button className="ghost" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <main>
        <p className="phase">Phase 1.0.3 — authentication</p>

        <div className="card">
          <h2>You are signed in</h2>
          <ul>
            <li>Email: {user!.email}</li>
            <li>Roles: {user!.roles.join(', ')}</li>
            <li>Teams: {user!.teams.length ? user!.teams.map((t) => t.name).join(', ') : '—'}</li>
            <li>Last login: {user!.lastLoginAt ? new Date(user!.lastLoginAt).toLocaleString() : 'first time'}</li>
          </ul>
        </div>

        <div className="card">
          <h2>Backend health (protected call succeeded)</h2>
          {health ? (
            <ul>
              <li>API status: <b className={health.status === 'ok' ? 'ok' : 'bad'}>{health.status}</b></li>
              <li>Database: <b className={health.db === 'connected' ? 'ok' : 'bad'}>{health.db}</b></li>
            </ul>
          ) : (
            <p className="muted">Checking…</p>
          )}
        </div>

        <p className="muted small">
          Next step builds the Users, Roles, Departments &amp; Teams admin screens.
        </p>
      </main>
    </div>
  )
}
