import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

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
  onSeeAll,
}: {
  count: number
  onRefresh: () => void
  onOpenTicket: (id: string) => void
  onSeeAll: () => void
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Notif[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    void api<Notif[]>('/notifications').then((r) => setRows(r.slice(0, 8)))
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
              <button
                key={n.id}
                className={`bell-item ${n.readAt ? '' : 'unread'}`}
                onClick={() => activate(n)}
              >
                <b>{n.title}</b>
                {n.body && <div className="muted small">{n.body}</div>}
                <div className="muted small">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </button>
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
