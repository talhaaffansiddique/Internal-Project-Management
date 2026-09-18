import { useEffect, useState } from 'react'
import { api } from '../../api'

interface Overview {
  tickets: {
    total: number
    open: number
    byStatus: Record<string, number>
    byType: Record<string, number>
    byDepartment: Record<string, number>
    byTeam: Record<string, number>
    avgResolutionDays: number | null
    resolvedCount: number
  }
  projects: {
    total: number
    byStatus: Record<string, number>
    delayed: { number: number; title: string; targetDate: string | null }[]
  }
  tasks: {
    total: number
    byStatus: Record<string, number>
    overdue: number
  }
  meetings: {
    totalMeetings: number
    byResponse: Record<string, number>
    attendanceRate: number | null
    pendingResponses: number
  }
  trainings: {
    total: number
    byStatus: Record<string, number>
    completed: number
    completionRate: number | null
    followUpRequired: number
  }
  procurement: {
    total: number
    byStatus: Record<string, number>
    pendingApproval: number
  }
  workload: {
    totalOpenActivities: number
    totalOverdueActivities: number
    perEmployee: { userId: string; fullName: string; open: number; overdue: number }[]
  }
}

const TICKET_STATUS_LABEL: Record<string, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  waiting_for_user: 'Waiting for User',
  resolved: 'Resolved',
  closed: 'Closed',
}
const PROC_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Awaiting Supervisor',
  AWAITING_DIRECTOR: 'Awaiting Director',
  WITH_PURCHASING: 'With Purchasing',
  AWAITING_FINAL_APPROVAL: 'Awaiting Final Approval',
  ORDERED: 'Ordered',
  DELIVERED: 'Delivered',
  REJECTED: 'Rejected',
}
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`)

function BreakdownTable({
  rows,
  labels,
}: {
  rows: Record<string, number>
  labels?: Record<string, string>
}) {
  const entries = Object.entries(rows).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return <p className="muted small">No data yet.</p>
  const max = Math.max(...entries.map(([, v]) => v), 1)
  return (
    <ul className="mini-list">
      {entries.map(([key, value]) => (
        <li key={key}>
          <span>{labels?.[key] ?? key}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="progress-wrap small">
              <span className="progress-bar" style={{ width: `${(value / max) * 100}%` }} />
            </span>
            <b className="mono">{value}</b>
          </span>
        </li>
      ))}
    </ul>
  )
}

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: 'warn' | 'bad' }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ?? ''}`}>{value}</div>
    </div>
  )
}

export default function Reports() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<Overview>('/reports/overview')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load reports'))
  }, [])

  if (error) return <p className="error-text">{error}</p>
  if (!data) return <p className="muted">Loading…</p>

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Management Reporting</h1>
          <p className="muted">
            A cross-module snapshot — department performance, aging, delays, completion and
            workload. Visible to Super Admin only for now.
          </p>
        </div>
      </div>

      <h2 style={{ fontSize: 15, margin: '22px 0 10px' }}>Tickets</h2>
      <div className="cards">
        <Tile label="Total tickets" value={data.tickets.total} />
        <Tile label="Open" value={data.tickets.open} />
        <Tile label="Resolved" value={data.tickets.resolvedCount} />
        <Tile
          label="Avg. resolution"
          value={
            data.tickets.avgResolutionDays === null
              ? '—'
              : `${data.tickets.avgResolutionDays.toFixed(1)}d`
          }
        />
      </div>
      <div className="detail-grid">
        <div className="card">
          <h3>By status</h3>
          <BreakdownTable rows={data.tickets.byStatus} labels={TICKET_STATUS_LABEL} />
        </div>
        <div className="card">
          <h3>By department</h3>
          <BreakdownTable rows={data.tickets.byDepartment} />
        </div>
        <div className="card">
          <h3>By team</h3>
          <BreakdownTable rows={data.tickets.byTeam} />
        </div>
        <div className="card">
          <h3>By type</h3>
          <BreakdownTable rows={data.tickets.byType} />
        </div>
      </div>

      <h2 style={{ fontSize: 15, margin: '26px 0 10px' }}>Projects &amp; Tasks</h2>
      <div className="cards">
        <Tile label="Total projects" value={data.projects.total} />
        <Tile
          label="Delayed projects"
          value={data.projects.delayed.length}
          tone={data.projects.delayed.length ? 'bad' : undefined}
        />
        <Tile label="Total tasks" value={data.tasks.total} />
        <Tile label="Overdue tasks" value={data.tasks.overdue} tone={data.tasks.overdue ? 'bad' : undefined} />
      </div>
      <div className="detail-grid">
        <div className="card">
          <h3>Projects by status</h3>
          <BreakdownTable rows={data.projects.byStatus} />
        </div>
        <div className="card">
          <h3>Delayed projects</h3>
          {data.projects.delayed.length === 0 ? (
            <p className="muted small">Nothing delayed.</p>
          ) : (
            <ul className="mini-list">
              {data.projects.delayed.map((p) => (
                <li key={p.number}>
                  <span>
                    <b className="mono">PRJ-{String(p.number).padStart(4, '0')}</b> {p.title}
                  </span>
                  <span className="muted small">
                    {p.targetDate ? `due ${new Date(p.targetDate).toLocaleDateString()}` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3>Tasks by status</h3>
          <BreakdownTable rows={data.tasks.byStatus} />
        </div>
      </div>

      <h2 style={{ fontSize: 15, margin: '26px 0 10px' }}>Meetings &amp; Training</h2>
      <div className="cards">
        <Tile label="Total meetings" value={data.meetings.totalMeetings} />
        <Tile label="Attendance rate" value={pct(data.meetings.attendanceRate)} />
        <Tile label="Pending RSVPs" value={data.meetings.pendingResponses} />
        <Tile label="Training completion" value={pct(data.trainings.completionRate)} />
        <Tile
          label="Follow-up required"
          value={data.trainings.followUpRequired}
          tone={data.trainings.followUpRequired ? 'warn' : undefined}
        />
      </div>
      <div className="detail-grid">
        <div className="card">
          <h3>Meeting RSVPs</h3>
          <BreakdownTable rows={data.meetings.byResponse} />
        </div>
        <div className="card">
          <h3>Training by status</h3>
          <BreakdownTable rows={data.trainings.byStatus} />
        </div>
      </div>

      <h2 style={{ fontSize: 15, margin: '26px 0 10px' }}>Procurement</h2>
      <div className="cards">
        <Tile label="Total requests" value={data.procurement.total} />
        <Tile label="Pending approval" value={data.procurement.pendingApproval} tone={data.procurement.pendingApproval ? 'warn' : undefined} />
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>By stage</h3>
        <BreakdownTable rows={data.procurement.byStatus} labels={PROC_STATUS_LABEL} />
      </div>

      <h2 style={{ fontSize: 15, margin: '26px 0 10px' }}>Employee workload</h2>
      <div className="cards">
        <Tile label="Open activities" value={data.workload.totalOpenActivities} />
        <Tile
          label="Overdue activities"
          value={data.workload.totalOverdueActivities}
          tone={data.workload.totalOverdueActivities ? 'bad' : undefined}
        />
      </div>
      <div className="card">
        <h3>Busiest employees</h3>
        {data.workload.perEmployee.length === 0 ? (
          <p className="muted small">No open activities.</p>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Open activities</th>
                <th>Overdue</th>
              </tr>
            </thead>
            <tbody>
              {data.workload.perEmployee.map((e) => (
                <tr key={e.userId} style={{ cursor: 'default' }}>
                  <td>{e.fullName}</td>
                  <td>{e.open}</td>
                  <td className={e.overdue ? 'bad' : 'muted'}>{e.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
