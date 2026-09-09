import { useState } from 'react'
import { useAuth } from './auth'
import Users from './pages/admin/Users'
import Departments from './pages/admin/Departments'
import Teams from './pages/admin/Teams'
import MasterData from './pages/admin/MasterData'

type View = 'dashboard' | 'users' | 'departments' | 'teams' | 'masterdata'

const NAV: { key: View; label: string; group: string }[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'Main' },
  { key: 'users', label: 'Users', group: 'Administration' },
  { key: 'departments', label: 'Departments', group: 'Administration' },
  { key: 'teams', label: 'Teams', group: 'Administration' },
  { key: 'masterdata', label: 'Master Data', group: 'Administration' },
]

export default function AdminApp() {
  const { user, logout } = useAuth()
  const [view, setView] = useState<View>('dashboard')

  const canAdmin =
    !!user &&
    user.roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN')

  const initials = user!.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')

  const groups = [...new Set(NAV.map((n) => n.group))]

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="side-brand">
          <span className="logo">OP</span> OpsHub
        </div>
        {groups.map((g) => (
          <div key={g}>
            <div className="side-group">{g}</div>
            {NAV.filter((n) => n.group === g).map((n) => {
              const locked = n.group === 'Administration' && !canAdmin
              return (
                <button
                  key={n.key}
                  className={`side-item ${view === n.key ? 'active' : ''}`}
                  disabled={locked}
                  onClick={() => setView(n.key)}
                  title={locked ? 'Requires Admin role' : undefined}
                >
                  {n.label}
                </button>
              )
            })}
          </div>
        ))}
      </aside>

      <div className="content">
        <header className="topbar">
          <div className="phase">Phase 1.0.5 — master data</div>
          <div className="who">
            <span className="avatar">{initials}</span>
            <div>
              <b>{user!.fullName}</b>
              <div className="muted small">
                {user!.roleNames.join(', ')} · {user!.primaryDepartment?.name ?? 'No dept'}
              </div>
            </div>
            <button className="btn ghost" onClick={logout}>Log out</button>
          </div>
        </header>

        <main className="page">
          {view === 'dashboard' && (
            <div>
              <h1>Dashboard</h1>
              <p className="muted">
                Placeholder. Real dashboard arrives in Phase 1.0.10.
              </p>
              {!canAdmin && (
                <p className="muted small">
                  Your account does not have the Admin or Super Admin role, so the
                  Administration screens are locked.
                </p>
              )}
            </div>
          )}
          {view === 'users' && canAdmin && <Users />}
          {view === 'departments' && canAdmin && <Departments />}
          {view === 'teams' && canAdmin && <Teams />}
          {view === 'masterdata' && canAdmin && <MasterData />}
        </main>
      </div>
    </div>
  )
}
