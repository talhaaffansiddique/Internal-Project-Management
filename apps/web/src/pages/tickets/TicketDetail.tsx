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

  async function assign(assigneeId: string) {
    await api(`/tickets/${id}/assignee`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeId: assigneeId || null }),
    })
    await load()
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

      <div className="detail-grid">
        <div>
          <div className="card">
            <div className="kv">
              <span>Status</span>
              <b>
                <span className="badge warn">
                  {STATUS_LABEL[ticket.statusKey] ?? ticket.statusKey}
                </span>
              </b>
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
    </div>
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
