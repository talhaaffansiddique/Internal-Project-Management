import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth'
import { api } from './api'
import { NotificationBell } from './components/NotificationBell'
import Users from './pages/admin/Users'
import Departments from './pages/admin/Departments'
import Teams from './pages/admin/Teams'
import MasterData from './pages/admin/MasterData'
import MyWork from './pages/MyWork'
import Notifications from './pages/Notifications'
import Tickets from './pages/tickets/Tickets'

type View =
  | 'dashboard'
  | 'mywork'
  | 'tickets'
  | 'notifications'
  | 'users'
  | 'departments'
  | 'teams'
  | 'masterdata'

const NAV: { key: View; label: string; group: string; admin?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'Main' },
  { key: 'mywork', label: 'My Work', group: 'Main' },
  { key: 'tickets', label: 'Tickets & Requests', group: 'Main' },
  { key: 'notifications', label: 'Notifications', group: 'Main' },
  { key: 'users', label: 'Users', group: 'Administration', admin: true },
  { key: 'departments', label: 'Departments', group: 'Administration', admin: true },
  { key: 'teams', label: 'Teams', group: 'Administration', admin: true },
  { key: 'masterdata', label: 'Master Data', group: 'Administration', admin: true },
]

export default function AdminApp() {
  const { user, logout } = useAuth()
  const [view, setView] = useState<View>('dashboard')
  const [unread, setUnread] = useState(0)
  const [ticketToOpen, setTicketToOpen] = useState<string | null>(null)

  const refreshUnread = useCallback(() => {
    api<{ count: number }>('/notifications/unread-count')
      .then((r) => setUnread(r.count))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshUnread()
    const t = setInterval(refreshUnread, 30000)
    return () => clearInterval(t)
  }, [refreshUnread])

  function openTicket(id: string) {
    setTicketToOpen(id)
    setView('tickets')
  }

  const canAdmin = !!user?.roles.some(
    (r) => r === 'ADMIN' || r === 'SUPER_ADMIN',
  )
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
              const locked = n.admin && !canAdmin
              return (
                <button
                  key={n.key}
                  className={`side-item ${view === n.key ? 'active' : ''}`}
                  disabled={locked}
                  onClick={() => setView(n.key)}
                  title={locked ? 'Requires Admin role' : undefined}
                >
                  {n.label}
                  {n.key === 'notifications' && unread > 0 && (
                    <span className="count">{unread}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </aside>

      <div className="content">
        <header className="topbar">
          <div className="phase">Phase 1.0.9 — in-app notifications</div>
          <div className="who">
            <NotificationBell
              count={unread}
              onRefresh={refreshUnread}
              onOpenTicket={openTicket}
              onSeeAll={() => setView('notifications')}
            />
            <span className="avatar">{initials}</span>
            <div>
              <b>{user!.fullName}</b>
              <div className="muted small">
                {user!.roleNames.join(', ')} ·{' '}
                {user!.primaryDepartment?.name ?? 'No dept'}
              </div>
            </div>
            <button className="btn ghost" onClick={logout}>
              Log out
            </button>
          </div>
        </header>

        <main className="page">
          {view === 'dashboard' && (
            <div>
              <h1>Dashboard</h1>
              <p className="muted">Placeholder. Real dashboard arrives in Phase 1.0.10.</p>
            </div>
          )}
          {view === 'mywork' && <MyWork />}
          {view === 'tickets' && (
            <Tickets
              initialTicketId={ticketToOpen}
              onConsumed={() => setTicketToOpen(null)}
            />
          )}
          {view === 'notifications' && (
            <Notifications onChanged={refreshUnread} onOpenTicket={openTicket} />
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
