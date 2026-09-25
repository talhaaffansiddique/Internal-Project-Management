import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { api } from '../api'
import { subscribeNotificationsChanged } from '../notificationsStream'

interface Notif {
  id: string
  type: string
  title: string
  body: string | null
  entityType: string | null
  entityId: string | null
  readAt: string | null
  createdAt: string
}

export function NotificationBell({
  count,
  onRefresh,
  onOpenTicket,
  onOpenMeeting,
  onSeeAll,
}: {
  count: number
  onRefresh: () => void
  onOpenTicket: (id: string) => void
  onOpenMeeting?: (id: string) => void
  onSeeAll: () => void
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Notif[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const load = () =>
      void api<Notif[]>('/notifications').then((r) => setRows(r.slice(0, 8)))
    load()
    return subscribeNotificationsChanged(load)
  }, [open])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function activate(n: Notif) {
    if (!n.readAt) {
      await api(`/notifications/${n.id}/read`, { method: 'POST' })
      onRefresh()
    }
    if (n.entityType === 'TICKET' && n.entityId) {
      onOpenTicket(n.entityId)
      setOpen(false)
    }
    if (n.entityType === 'MEETING' && n.entityId) {
      onOpenMeeting?.(n.entityId)
      setOpen(false)
    }
  }

  async function markAll() {
    await api('/notifications/read-all', { method: 'POST' })
    onRefresh()
    setRows((rs) =>
      rs.map((r) => ({ ...r, readAt: r.readAt ?? new Date().toISOString() })),
    )
  }

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button
        className="bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        🔔
        {count > 0 && <span className="bell-count">{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <div className="bell-menu">
          <div className="bell-head">
            <b>Notifications</b>
            {count > 0 && (
              <button className="linklike" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          {rows.length === 0 ? (
            <p className="muted small" style={{ padding: 12 }}>
              Nothing yet.
            </p>
          ) : (
            rows.map((n) => (
              <div
                key={n.id}
                className={`bell-item ${n.readAt ? '' : 'unread'}`}
                role="button"
                tabIndex={0}
                onClick={() => activate(n)}
                onKeyDown={(e) => e.key === 'Enter' && activate(n)}
              >
                <b>{n.title}</b>
                {n.body && <div className="muted small">{n.body}</div>}
                {n.type === 'MEETING_INVITATION' && n.entityType === 'MEETING' && n.entityId && (
                  <BellRsvpButtons meetingId={n.entityId} onDone={onRefresh} />
                )}
                <div className="muted small">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
          <button
            className="bell-all linklike"
            onClick={() => {
              onSeeAll()
              setOpen(false)
            }}
          >
            See all
          </button>
        </div>
      )}
    </div>
  )
}

function BellRsvpButtons({
  meetingId,
  onDone,
}: {
  meetingId: string
  onDone: () => void
}) {
  const [responded, setResponded] = useState<'ACCEPTED' | 'TENTATIVE' | 'DECLINED' | null>(null)
  const [busy, setBusy] = useState(false)

  async function respond(e: ReactMouseEvent, response: 'ACCEPTED' | 'TENTATIVE' | 'DECLINED') {
    e.stopPropagation()
    setBusy(true)
    try {
      await api(`/meetings/${meetingId}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ response }),
      })
      setResponded(response)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  if (responded) {
    const label = { ACCEPTED: 'Accepted', TENTATIVE: 'Marked as maybe', DECLINED: 'Declined' }[responded]
    return <div className="muted small">You responded: {label}</div>
  }

  return (
    <div style={{ display: 'flex', gap: 5, margin: '4px 0' }}>
      <button className="btn tiny primary" disabled={busy} onClick={(e) => respond(e, 'ACCEPTED')}>
        Accept
      </button>
      <button className="btn tiny" disabled={busy} onClick={(e) => respond(e, 'TENTATIVE')}>
        Maybe
      </button>
      <button className="btn tiny" disabled={busy} onClick={(e) => respond(e, 'DECLINED')}>
        Decline
      </button>
    </div>
  )
}
