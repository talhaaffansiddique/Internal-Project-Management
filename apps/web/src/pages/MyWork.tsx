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

interface Activity {
  id: string
  title: string
  dueAt: string
  entityType: string | null
  entityId: string | null
  createdBy: { fullName: string }
}

interface MyWorkData {
  myTickets: {
    id: string
    number: number
    subject: string
    statusKey: string
    createdAt: string
    role: 'requester' | 'assignee' | 'follower'
  }[]
  activities: { overdue: Activity[]; dueSoon: Activity[]; later: Activity[] }
  counts: {
    myOpenTickets: number
    myOpenActivities: number
    overdueActivities: number
  }
}

export default function MyWork({
  onOpenTicket,
}: {
  onOpenTicket: (id: string) => void
}) {
  const [d, setD] = useState<MyWorkData | null>(null)

  async function load() {
    setD(await api<MyWorkData>('/me/work'))
  }
  useEffect(() => {
    void load()
  }, [])

  async function complete(id: string) {
    await api(`/activities/${id}/complete`, { method: 'POST' })
    void load()
  }

  if (!d) return <p className="muted">Loading…</p>

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>My Work</h1>
          <p className="muted">Everything assigned to or followed by you.</p>
        </div>
      </div>

      <div className="cards">
        <div className="stat">
          <div className="stat-label">My open tickets</div>
          <div className="stat-value">{d.counts.myOpenTickets}</div>
        </div>
        <div className="stat">
          <div className="stat-label">My open activities</div>
          <div className="stat-value">{d.counts.myOpenActivities}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Overdue</div>
          <div
            className={`stat-value ${d.counts.overdueActivities ? 'bad' : ''}`}
          >
            {d.counts.overdueActivities}
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>My tickets</h3>
        <div className="panel-body">
          {d.myTickets.length === 0 ? (
            <p className="muted small" style={{ padding: '10px 16px' }}>
              Nothing open.
            </p>
          ) : (
            <table className="grid">
              <tbody>
                {d.myTickets.map((t) => (
                  <tr key={t.id} onClick={() => onOpenTicket(t.id)}>
                    <td style={{ width: 90 }}>
                      <b className="mono">{ticketNo(t.number)}</b>
                    </td>
                    <td>
                      {t.subject}
                      <span className="role-chip">{t.role}</span>
                    </td>
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

      <ActivityGroup
        title="Overdue"
        rows={d.activities.overdue}
        tone="bad"
        onComplete={complete}
        onOpenTicket={onOpenTicket}
      />
      <ActivityGroup
        title="Due in the next 7 days"
        rows={d.activities.dueSoon}
        onComplete={complete}
        onOpenTicket={onOpenTicket}
      />
      <ActivityGroup
        title="Later"
        rows={d.activities.later}
        onComplete={complete}
        onOpenTicket={onOpenTicket}
      />
    </div>
  )
}

function ActivityGroup({
  title,
  rows,
  tone,
  onComplete,
  onOpenTicket,
}: {
  title: string
  rows: Activity[]
  tone?: 'bad'
  onComplete: (id: string) => void
  onOpenTicket: (id: string) => void
}) {
  if (rows.length === 0) return null
  return (
    <div className="panel">
      <h3>
        {title} ({rows.length})
      </h3>
      <div className="panel-body">
        <table className="grid">
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <b>{a.title}</b>
                  {a.entityType === 'TICKET' && a.entityId && (
                    <button
                      className="linklike"
                      style={{ marginLeft: 8, fontSize: 12 }}
                      onClick={() => onOpenTicket(a.entityId!)}
                    >
                      on a ticket →
                    </button>
                  )}
                </td>
                <td className={tone === 'bad' ? 'bad' : ''} style={{ width: 200 }}>
                  {new Date(a.dueAt).toLocaleString()}
                </td>
                <td style={{ width: 110 }} onClick={(e) => e.stopPropagation()}>
                  <button className="btn tiny" onClick={() => onComplete(a.id)}>
                    Mark done
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
