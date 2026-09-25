import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth, type CurrentUser } from '../auth'
import { subscribeNotificationsChanged } from '../notificationsStream'

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
  onOpenMeeting,
}: {
  onChanged?: () => void
  onOpenTicket?: (id: string) => void
  onOpenMeeting?: (id: string) => void
}) {
  const [rows, setRows] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  // `silent` skips the loading flag so a live push-driven refresh doesn't
  // flash "Loading…" over the list that's already on screen.
  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      setRows(await api<Notification[]>('/notifications'))
    } finally {
      if (!silent) setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    return subscribeNotificationsChanged(() => void load(true))
  }, [])

  async function activate(n: Notification) {
    if (!n.readAt) {
      await api(`/notifications/${n.id}/read`, { method: 'POST' })
      void load(true)
      onChanged?.()
    }
    if (n.entityType === 'TICKET' && n.entityId) {
      onOpenTicket?.(n.entityId)
    }
    if (n.entityType === 'MEETING' && n.entityId) {
      onOpenMeeting?.(n.entityId)
    }
  }

  async function markAll() {
    await api('/notifications/read-all', { method: 'POST' })
    void load(true)
    onChanged?.()
  }

  const unread = rows.filter((r) => !r.readAt).length
  const clickable = (n: Notification) =>
    (n.entityType === 'TICKET' || n.entityType === 'MEETING') && !!n.entityId
  const isMeetingInvite = (n: Notification) =>
    n.type === 'MEETING_INVITATION' && n.entityType === 'MEETING' && !!n.entityId

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

      <WhatsAppSettings />

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
                {isMeetingInvite(n) && (
                  <RsvpButtons meetingId={n.entityId!} />
                )}
                {clickable(n) && (
                  <div className="muted small">
                    {n.entityType === 'TICKET' ? 'Open ticket →' : 'Open meeting →'}
                  </div>
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

function RsvpButtons({ meetingId }: { meetingId: string }) {
  const [responded, setResponded] = useState<'ACCEPTED' | 'TENTATIVE' | 'DECLINED' | null>(null)
  const [busy, setBusy] = useState(false)

  async function respond(response: 'ACCEPTED' | 'TENTATIVE' | 'DECLINED') {
    setBusy(true)
    try {
      await api(`/meetings/${meetingId}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ response }),
      })
      setResponded(response)
    } finally {
      setBusy(false)
    }
  }

  if (responded) {
    const label = { ACCEPTED: 'Accepted', TENTATIVE: 'Marked as maybe', DECLINED: 'Declined' }[responded]
    return <div className="muted small" style={{ marginTop: 6 }}>You responded: {label}</div>
  }

  return (
    <div
      style={{ display: 'flex', gap: 6, marginTop: 8 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button className="btn tiny primary" disabled={busy} onClick={() => respond('ACCEPTED')}>
        Accept
      </button>
      <button className="btn tiny" disabled={busy} onClick={() => respond('TENTATIVE')}>
        Maybe
      </button>
      <button className="btn tiny" disabled={busy} onClick={() => respond('DECLINED')}>
        Decline
      </button>
    </div>
  )
}

function WhatsAppSettings() {
  const { user, setUser } = useAuth()
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '')
  const [optIn, setOptIn] = useState(user?.whatsappOptIn ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await api<CurrentUser>('/auth/me/notification-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim() || null,
          whatsappOptIn: optIn,
        }),
      })
      setUser(updated)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <h3>WhatsApp alerts</h3>
      <div className="panel-body" style={{ padding: '14px 16px' }}>
        <p className="muted small" style={{ marginTop: 0 }}>
          Get a WhatsApp message for ticket updates, procurement approvals, and @mentions,
          on top of your in-app notifications.
        </p>
        <div className="field">
          <label className="field-label">Phone number (international format)</label>
          <input
            type="tel"
            placeholder="+923001234567"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            style={{ maxWidth: 260 }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
          />
          <span className="small">Send me WhatsApp alerts</span>
        </label>
        <button className="btn primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="muted small" style={{ marginLeft: 10 }}>Saved.</span>}
        {error && <span className="bad small" style={{ marginLeft: 10 }}>{error}</span>}
      </div>
    </div>
  )
}
