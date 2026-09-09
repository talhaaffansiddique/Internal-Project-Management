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

export default function Notifications({ onChanged }: { onChanged?: () => void }) {
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

  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, { method: 'POST' })
    void load()
    onChanged?.()
  }
  async function markAll() {
    await api('/notifications/read-all', { method: 'POST' })
    void load()
    onChanged?.()
  }

  const unread = rows.filter((r) => !r.readAt).length

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p className="muted">
            In-app only for now — {unread} unread.
          </p>
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
              className={`notif ${n.readAt ? '' : 'unread'}`}
              onClick={() => !n.readAt && markRead(n.id)}
            >
              <span className="badge muted">{n.type.toLowerCase()}</span>
              <div className="notif-main">
                <b>{n.title}</b>
                {n.body && <div className="muted small">{n.body}</div>}
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
