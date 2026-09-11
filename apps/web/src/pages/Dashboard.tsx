import { useEffect, useState } from 'react'
import { api } from '../api'
import { useTheme } from '../theme'

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
  // A shared scale so each card's ring/bar/bloom reads relative to its
  // siblings, not an arbitrary fixed ceiling.
  const maxVal = Math.max(
    1,
    c.open, c.in_progress, c.waiting_for_user, c.unassigned, c.resolved, c.overdueActivities,
  )

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
        <Stat label="Open tickets" value={c.open} max={maxVal} />
        <Stat label="In progress" value={c.in_progress} max={maxVal} />
        <Stat label="Waiting for user" value={c.waiting_for_user} max={maxVal} />
        <Stat
          label="Unassigned"
          value={c.unassigned}
          max={maxVal}
          tone={c.unassigned ? 'warn' : undefined}
        />
        <Stat label="Resolved" value={c.resolved} max={maxVal} />
        <Stat
          label="Overdue activities"
          value={c.overdueActivities}
          max={maxVal}
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
  max,
  tone,
}: {
  label: string
  value: number
  max: number
  tone?: 'warn' | 'bad'
}) {
  const { skin } = useTheme()
  const pct = Math.max(4, Math.min(100, Math.round((value / max) * 100)))
  const toneVar = tone === 'bad' ? 'var(--danger)' : tone === 'warn' ? '#d97706' : 'var(--primary)'

  if (skin === 'harbor') {
    const r = 17
    const c = 2 * Math.PI * r
    return (
      <div className="stat stat-ring">
        <svg width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="5" />
          <circle
            cx="22" cy="22" r={r} fill="none" stroke={toneVar} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
            transform="rotate(-90 22 22)" style={{ transition: 'stroke-dashoffset .6s ease' }}
          />
        </svg>
        <div>
          <div className="stat-value mono" style={{ color: toneVar }}>{value}</div>
          <div className="stat-label">{label}</div>
        </div>
      </div>
    )
  }

  if (skin === 'foundry') {
    return (
      <div className="stat stat-bar">
        <div className="stat-label">{label}</div>
        <div className="stat-value mono" style={{ color: toneVar }}>{String(value).padStart(2, '0')}</div>
        <div className="stat-bar-track">
          <span style={{ width: `${pct}%`, background: toneVar }} />
        </div>
      </div>
    )
  }

  if (skin === 'meadow') {
    return (
      <div className="stat stat-bloom">
        <div className="stat-label">{label}</div>
        <div className="stat-value" style={{ color: toneVar }}>{value}</div>
        <div className="bloom"><span key={pct} style={{ width: `${pct}%`, background: toneVar }} /></div>
      </div>
    )
  }

  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ?? ''}`}>{value}</div>
    </div>
  )
}
