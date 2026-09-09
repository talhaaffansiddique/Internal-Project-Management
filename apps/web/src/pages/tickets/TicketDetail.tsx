import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import type { Ticket, UserLookup } from '../../types'
import { Modal, Field, ErrorText } from '../../ui'
import {
  Chatter,
  EntityActivities,
  EntityAttachments,
  EntityAudit,
} from '../../components/entity-panels'

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  waiting_for_user: 'Waiting for User',
  resolved: 'Resolved',
  closed: 'Closed',
}

function ticketNo(n: number) {
  return `TKT-${String(n).padStart(4, '0')}`
}

type Tab = 'discussion' | 'activity' | 'files' | 'history'

export default function TicketDetail({
  id,
  onBack,
}: {
  id: string
  onBack: () => void
}) {
  const { user } = useAuth()
  const isAdmin = !!user?.roles.some(
    (r) => r === 'ADMIN' || r === 'SUPER_ADMIN',
  )
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('discussion')
  const [editing, setEditing] = useState(false)
  const [people, setPeople] = useState<UserLookup[]>([])

  async function load() {
    try {
      setTicket(await api<Ticket>(`/tickets/${id}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load ticket')
    }
  }
  useEffect(() => {
    void load()
    if (isAdmin) void api<UserLookup[]>('/users/lookup').then(setPeople)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const [statusBusy, setStatusBusy] = useState(false)
  const [reopening, setReopening] = useState(false)

  async function assign(assigneeId: string) {
    await api(`/tickets/${id}/assignee`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeId: assigneeId || null }),
    })
    await load()
  }

  async function changeStatus(statusKey: string) {
    if (!statusKey) return
    setStatusBusy(true)
    try {
      await api(`/tickets/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ statusKey }),
      })
      await load()
    } finally {
      setStatusBusy(false)
    }
  }

  async function closeTicket() {
    if (!confirm('Close this ticket? It will record that you closed it, and when.')) return
    setStatusBusy(true)
    try {
      await api(`/tickets/${id}/close`, { method: 'POST', body: '{}' })
      await load()
    } finally {
      setStatusBusy(false)
    }
  }

  if (error) {
    return (
      <div>
        <button className="btn" onClick={onBack}>← Back</button>
        <p className="error-text" style={{ marginTop: 16 }}>{error}</p>
      </div>
    )
  }
  if (!ticket) return <p className="muted">Loading…</p>

  return (
    <div>
      <button className="btn" onClick={onBack}>← All tickets</button>

      <div className="page-head" style={{ marginTop: 14 }}>
        <div>
          <h1>
            <span className="muted">{ticketNo(ticket.number)}</span> {ticket.subject}
          </h1>
          <p className="muted small">
            {ticket.form?.label ?? ticket.type} · raised by {ticket.requester.fullName} ·{' '}
            {new Date(ticket.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setEditing(true)}>Edit</button>
        </div>
      </div>

      <div className="status-bar">
        <span className={`badge status-${ticket.statusKey}`}>
          {STATUS_LABEL[ticket.statusKey] ?? ticket.statusKey}
        </span>

        {ticket.statusKey === 'closed' ? (
          <>
            <span className="muted small">
              Closed by {ticket.closedBy?.fullName ?? '—'}
              {ticket.closedAt &&
                ` on ${new Date(ticket.closedAt).toLocaleString()}`}
            </span>
            {ticket.permissions?.isAdmin && (
              <button
                className="btn"
                disabled={statusBusy}
                onClick={() => setReopening(true)}
              >
                Reopen
              </button>
            )}
          </>
        ) : (
          ticket.permissions?.mayAct && (
            <>
              {(ticket.allowedTransitions ?? []).length > 0 && (
                <select
                  disabled={statusBusy}
                  defaultValue=""
                  onChange={(e) => changeStatus(e.target.value)}
                >
                  <option value="" disabled>
                    Move to…
                  </option>
                  {(ticket.allowedTransitions ?? []).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s] ?? s}
                    </option>
                  ))}
                </select>
              )}
              <button
                className="btn danger"
                disabled={statusBusy}
                onClick={closeTicket}
              >
                Close ticket
              </button>
            </>
          )
        )}
      </div>

      {ticket.statusKey !== 'closed' && ticket.reopenReason && (
        <p className="banner">
          Reopened — reason: {ticket.reopenReason}
        </p>
      )}

      <div className="detail-grid">
        <div>
          <div className="card">
            <div className="kv">
              <span>Priority</span>
              <b>{ticket.priority ?? <span className="muted">— not set</span>}</b>
              <span>Visibility</span>
              <b>
                {ticket.visibility === 'TEAM'
                  ? `Team · ${ticket.team?.name ?? '—'}`
                  : 'Private'}
              </b>
              <span>Assignee</span>
              <b>
                {isAdmin ? (
                  <select
                    value={ticket.assignee?.id ?? ''}
                    onChange={(e) => assign(e.target.value)}
                  >
                    <option value="">— unassigned —</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>{p.fullName}</option>
                    ))}
                  </select>
                ) : (
                  ticket.assignee?.fullName ?? <span className="muted">unassigned</span>
                )}
              </b>
            </div>
          </div>

          {ticket.description && (
            <div className="card">
              <h3>Description</h3>
              <p>{ticket.description}</p>
            </div>
          )}

          {ticket.form && ticket.fields && (
            <div className="card">
              <h3>{ticket.form.label} details</h3>
              <div className="kv">
                {ticket.form.fields.map((f) => (
                  <RowKV key={f.name} label={f.label} value={ticket.fields?.[f.name]} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="tabs">
            {(['discussion', 'activity', 'files', 'history'] as Tab[]).map((t) => (
              <button
                key={t}
                className={`tab ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="tab-body">
            {tab === 'discussion' && (
              <Chatter entityType="tickets" entityId={id} />
            )}
            {tab === 'activity' && (
              <EntityActivities entityType="tickets" entityId={id} />
            )}
            {tab === 'files' && (
              <EntityAttachments entityType="tickets" entityId={id} />
            )}
            {tab === 'history' && (
              <EntityAudit entityType="tickets" entityId={id} />
            )}
          </div>
        </div>
      </div>

      {editing && (
        <EditTicketModal
          ticket={ticket}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            void load()
          }}
        />
      )}

      {reopening && (
        <ReopenModal
          ticketId={id}
          onClose={() => setReopening(false)}
          onDone={() => {
            setReopening(false)
            void load()
          }}
        />
      )}
    </div>
  )
}

function ReopenModal({
  ticketId,
  onClose,
  onDone,
}: {
  ticketId: string
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await api(`/tickets/${ticketId}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reopen failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Reopen ticket"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={busy || reason.trim().length < 3}
          >
            {busy ? 'Reopening…' : 'Reopen'}
          </button>
        </>
      }
    >
      <Field label="Reason (required)" hint="Recorded in the ticket history.">
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}

function RowKV({ label, value }: { label: string; value?: string }) {
  return (
    <>
      <span>{label}</span>
      <b>{value ? value : <span className="muted">—</span>}</b>
    </>
  )
}

function EditTicketModal({
  ticket,
  onClose,
  onSaved,
}: {
  ticket: Ticket
  onClose: () => void
  onSaved: () => void
}) {
  const [subject, setSubject] = useState(ticket.subject)
  const [description, setDescription] = useState(ticket.description ?? '')
  const [priority, setPriority] = useState(ticket.priority ?? '')
  const [priorities, setPriorities] = useState<{ key: string; label: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void api<{ values: { key: string; label: string }[] }>('/master-data/priorities')
      .then((r) => setPriorities(r.values))
      .catch(() => {})
  }, [])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api(`/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          subject,
          description: description || undefined,
          priority: priority || undefined,
        }),
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Edit ${ticketNo(ticket.number)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy || !subject.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <Field label="Subject">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field label="Description">
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Priority" hint="Optional">
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">— not set —</option>
          {priorities.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}
