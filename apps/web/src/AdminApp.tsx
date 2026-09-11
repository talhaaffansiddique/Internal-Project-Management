import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth'
import { api } from './api'
import { NotificationBell } from './components/NotificationBell'
import { ThemeSwitch } from './theme'
import { APP_VERSION, APP_PHASE } from './version'
import Dashboard from './pages/Dashboard'
import Users from './pages/admin/Users'
import Departments from './pages/admin/Departments'
import Teams from './pages/admin/Teams'
import MasterData from './pages/admin/MasterData'
import MyWork from './pages/MyWork'
import Notifications from './pages/Notifications'
import Tickets from './pages/tickets/Tickets'
import Projects from './pages/projects/Projects'
import Tasks from './pages/Tasks'
import Meetings from './pages/meetings/Meetings'
import Training from './pages/training/Training'
import Procurement from './pages/procurement/Procurement'
import Appearance from './pages/admin/Appearance'

type View =
  | 'dashboard'
  | 'mywork'
  | 'tickets'
  | 'projects'
  | 'tasks'
  | 'meetings'
  | 'training'
  | 'procurement'
  | 'notifications'
  | 'users'
  | 'departments'
  | 'teams'
  | 'masterdata'
  | 'appearance'

const NAV: {
  key: View
  label: string
  group: string
  admin?: boolean
  superAdmin?: boolean
}[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'Main' },
  { key: 'mywork', label: 'My Work', group: 'Main' },
  { key: 'tickets', label: 'Tickets & Requests', group: 'Main' },
  { key: 'projects', label: 'Projects', group: 'Main' },
  { key: 'tasks', label: 'Tasks', group: 'Main' },
  { key: 'meetings', label: 'Meetings & Calendar', group: 'Main' },
  { key: 'training', label: 'Training', group: 'Main' },
  { key: 'procurement', label: 'Procurement', group: 'Main' },
  { key: 'notifications', label: 'Notifications', group: 'Main' },
  { key: 'users', label: 'Users', group: 'Administration', admin: true },
  { key: 'departments', label: 'Departments', group: 'Administration', admin: true },
  { key: 'teams', label: 'Teams', group: 'Administration', admin: true },
  { key: 'masterdata', label: 'Master Data', group: 'Administration', admin: true },
  { key: 'appearance', label: 'Appearance', group: 'Administration', admin: true, superAdmin: true },
]

export default function AdminApp() {
  const { user, logout } = useAuth()
  const [view, setView] = useState<View>('dashboard')
  const [unread, setUnread] = useState(0)
  const [ticketToOpen, setTicketToOpen] = useState<string | null>(null)
  const [projectToOpen, setProjectToOpen] = useState<string | null>(null)

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
  function openProject(id: string) {
    setProjectToOpen(id)
    setView('projects')
  }

  const canAdmin = !!user?.roles.some(
    (r) => r === 'ADMIN' || r === 'SUPER_ADMIN',
  )
  const isSuperAdmin = !!user?.roles.includes('SUPER_ADMIN')
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
          <span className="logo">C&amp;C</span> Captain Project Management
        </div>
        {groups.map((g) => (
          <div key={g}>
            <div className="side-group">{g}</div>
            {NAV.filter((n) => n.group === g).map((n) => {
              const locked = n.superAdmin ? !isSuperAdmin : n.admin && !canAdmin
              return (
                <button
                  key={n.key}
                  className={`side-item ${view === n.key ? 'active' : ''}`}
                  disabled={locked}
                  onClick={() => setView(n.key)}
                  title={locked ? (n.superAdmin ? 'Requires Super Admin role' : 'Requires Admin role') : undefined}
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
        <div className="side-foot">{APP_VERSION}</div>
      </aside>

      <div className="content">
        <header className="topbar">
          <div className="phase">{APP_PHASE}</div>
          <div className="who">
            <ThemeSwitch />
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
          {view === 'dashboard' && <Dashboard onOpenTicket={openTicket} />}
          {view === 'mywork' && <MyWork onOpenTicket={openTicket} />}
          {view === 'tickets' && (
            <Tickets
              initialTicketId={ticketToOpen}
              onConsumed={() => setTicketToOpen(null)}
            />
          )}
          {view === 'projects' && (
            <Projects
              initialProjectId={projectToOpen}
              onConsumed={() => setProjectToOpen(null)}
            />
          )}
          {view === 'tasks' && <Tasks onOpenProject={openProject} />}
          {view === 'meetings' && <Meetings />}
          {view === 'training' && <Training />}
          {view === 'procurement' && <Procurement />}
          {view === 'notifications' && (
            <Notifications onChanged={refreshUnread} onOpenTicket={openTicket} />
          )}
          {view === 'users' && canAdmin && <Users />}
          {view === 'departments' && canAdmin && <Departments />}
          {view === 'teams' && canAdmin && <Teams />}
          {view === 'masterdata' && canAdmin && <MasterData />}
          {view === 'appearance' && isSuperAdmin && <Appearance />}
        </main>
      </div>
    </div>
  )
}
