import { useEffect, useState } from 'react'
import { api } from '../api'

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  waiting_for_user: 'Waiting for User',
  resolved: 'Resolved',
  closed: 'Closed',
}
const ticketNo = (n: number) => `TKT-${String(n).padStart(4, '0')}`

interface DashData {
  counts: {
    open: number
    new: number
    assigned: number
    in_progress: number
    waiting_for_user: number
    resolved: number
    closed: number
    unassigned: number
    overdueActivities: number
    myOpenActivities: number
  }
  recent: {
    id: string
    number: number
    subject: string
    statusKey: string
    createdAt: string
    requester: { fullName: string }
    assignee: { fullName: string } | null
  }[]
}

export default function Dashboard({
  onOpenTicket,
}: {
  onOpenTicket: (id: string) => void
}) {
  const [d, setD] = useState<DashData | null>(null)

  useEffect(() => {
    void api<DashData>('/dashboard').then(setD)
  }, [])

  if (!d) return <p className="muted">Loading…</p>
  const c = d.counts

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">
            Your operations snapshot — limited to what you're authorized to see.
          </p>
        </div>
      </div>

      <div className="cards">
        <Stat label="Open tickets" value={c.open} />
        <Stat label="In progress" value={c.in_progress} />
        <Stat label="Waiting for user" value={c.waiting_for_user} />
        <Stat
          label="Unassigned"
          value={c.unassigned}
          tone={c.unassigned ? 'warn' : undefined}
        />
        <Stat label="Resolved" value={c.resolved} />
        <Stat
          label="Overdue activities"
          value={c.overdueActivities}
          tone={c.overdueActivities ? 'bad' : undefined}
        />
      </div>

      <div className="panel">
        <h3>Recent tickets</h3>
        <div className="panel-body">
          {d.recent.length === 0 ? (
            <p className="muted small" style={{ padding: '10px 16px' }}>
              No tickets yet.
            </p>
          ) : (
            <table className="grid">
              <tbody>
                {d.recent.map((t) => (
                  <tr key={t.id} onClick={() => onOpenTicket(t.id)}>
                    <td style={{ width: 90 }}>
                      <b>{ticketNo(t.number)}</b>
                    </td>
                    <td>{t.subject}</td>
                    <td>{t.requester.fullName}</td>
                    <td>{t.assignee?.fullName ?? <span className="muted">—</span>}</td>
                    <td className="muted small" style={{ width: 100 }}>
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ width: 150 }}>
                      <span className={`badge status-${t.statusKey}`}>
                        {STATUS_LABEL[t.statusKey] ?? t.statusKey}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'warn' | 'bad'
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ?? ''}`}>{value}</div>
    </div>
  )
}
