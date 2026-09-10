import { useEffect, useState } from 'react'
import { api } from '../api'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  entityType: string | null
  entityId: string | null
  readAt: string | null
  createdAt: string
}

export default function Notifications({
  onChanged,
  onOpenTicket,
}: {
  onChanged?: () => void
  onOpenTicket?: (id: string) => void
}) {
  const [rows, setRows] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      setRows(await api<Notification[]>('/notifications'))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  async function activate(n: Notification) {
    if (!n.readAt) {
      await api(`/notifications/${n.id}/read`, { method: 'POST' })
      void load()
      onChanged?.()
    }
    if (n.entityType === 'TICKET' && n.entityId) {
      onOpenTicket?.(n.entityId)
    }
  }

  async function markAll() {
    await api('/notifications/read-all', { method: 'POST' })
    void load()
    onChanged?.()
  }

  const unread = rows.filter((r) => !r.readAt).length
  const clickable = (n: Notification) =>
    n.entityType === 'TICKET' && !!n.entityId

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p className="muted">In-app only for now — {unread} unread.</p>
        </div>
        {unread > 0 && (
          <button className="btn" onClick={markAll}>
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No notifications.</p>
      ) : (
        <div className="notif-list">
          {rows.map((n) => (
            <div
              key={n.id}
              className={`notif ${n.readAt ? '' : 'unread'} ${
                clickable(n) ? 'link' : ''
              }`}
              onClick={() => (clickable(n) || !n.readAt) && activate(n)}
            >
              <span className="badge muted">{n.type.toLowerCase()}</span>
              <div className="notif-main">
                <b>{n.title}</b>
                {n.body && <div className="muted small">{n.body}</div>}
                {clickable(n) && (
                  <div className="muted small">Open ticket →</div>
                )}
              </div>
              <span className="muted small">
                {new Date(n.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
