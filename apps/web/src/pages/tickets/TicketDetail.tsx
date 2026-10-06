import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import type { Team, Ticket, UserLookup } from '../../types'
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
const TAB_LABEL: Record<Tab, string> = {
  discussion: 'Discussion',
  activity: 'To-dos',
  files: 'Files',
  history: 'Activity',
}

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
            <span className="muted mono">{ticketNo(ticket.number)}</span> {ticket.subject}
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
              <span>Created</span>
              <b>{new Date(ticket.createdAt).toLocaleString()}</b>
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

          {ticket.type === 'erp_issue' && (
            <ErpPanel
              ticket={ticket}
              canManage={
                ticket.statusKey !== 'closed' &&
                (isAdmin || ticket.assignee?.id === user?.id)
              }
              onChanged={() => void load()}
            />
          )}

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
                {TAB_LABEL[t]}
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

interface FollowerRow {
  id: string
  user: { id: string; fullName: string }
}

function ErpPanel({
  ticket,
  canManage,
  onChanged,
}: {
  ticket: Ticket
  canManage: boolean
  onChanged: () => void
}) {
  const [erpNo, setErpNo] = useState(ticket.erpTicketNumber ?? '')
  const [people, setPeople] = useState<UserLookup[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [followers, setFollowers] = useState<FollowerRow[]>([])
  const [visibility, setVisibility] = useState<'PRIVATE' | 'TEAM'>(ticket.visibility)
  const [teamId, setTeamId] = useState(ticket.team?.id ?? '')
  const [addId, setAddId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function loadFollowers() {
    setFollowers(await api<FollowerRow[]>(`/tickets/${ticket.id}/followers`))
  }
  useEffect(() => {
    void loadFollowers()
    if (!canManage) return
    void api<UserLookup[]>('/users/lookup').then(setPeople)
    void api<Team[]>('/teams').then(setTeams)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id, canManage])

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      await fn()
      setNote(done)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const saveErpNo = () =>
    run(
      () =>
        api(`/tickets/${ticket.id}/erp-number`, {
          method: 'PATCH',
          body: JSON.stringify({ erpTicketNumber: erpNo }),
        }),
      'ERP ticket number saved.',
    )

  const saveVisibility = () =>
    run(
      () =>
        api(`/tickets/${ticket.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            visibility,
            teamId: visibility === 'TEAM' ? teamId : undefined,
          }),
        }),
      'Visibility updated.',
    )

  const addPerson = () =>
    run(async () => {
      await api(`/tickets/${ticket.id}/followers`, {
        method: 'POST',
        body: JSON.stringify({ userId: addId }),
      })
      setAddId('')
      await loadFollowers()
    }, 'Person added.')

  const removePerson = (userId: string) =>
    run(async () => {
      await api(`/tickets/${ticket.id}/followers/${userId}`, { method: 'DELETE' })
      await loadFollowers()
    }, 'Person removed.')

  const registered = !!ticket.erpTicketNumber
  const visUnchanged =
    visibility === ticket.visibility &&
    (visibility === 'PRIVATE' || teamId === (ticket.team?.id ?? ''))

  return (
    <div className="card">
      <h3>ERP registration</h3>
      <div className="kv">
        <span>ERP ticket no.</span>
        <b>
          {registered ? (
            <>
              {ticket.erpTicketNumber}
              {ticket.erpRegisteredAt && (
                <span className="muted small">
                  {' '}· registered {new Date(ticket.erpRegisteredAt).toLocaleDateString()}
                </span>
              )}
            </>
          ) : (
            <span className="muted">Not registered with the ERP vendor yet</span>
          )}
        </b>
      </div>

      {canManage && (
        <>
          <div className="add-row" style={{ marginTop: 10 }}>
            <input
              placeholder="Enter the ERP ticket number"
              value={erpNo}
              onChange={(e) => setErpNo(e.target.value)}
              style={{
                flex: 1,
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                padding: '8px 10px',
                background: 'var(--surface)',
                color: 'var(--text)',
              }}
            />
            <button
              className="btn primary"
              disabled={busy || !erpNo.trim() || erpNo.trim() === (ticket.erpTicketNumber ?? '')}
              onClick={saveErpNo}
            >
              {registered ? 'Update' : 'Confirm registered'}
            </button>
          </div>
          <p className="muted small" style={{ margin: '6px 0 0' }}>
            Enter this once you have reviewed the complaint and logged it with the ERP company.
          </p>

          <h3 style={{ marginTop: 18 }}>Who can see this?</h3>
          <div className="add-row">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'PRIVATE' | 'TEAM')}
            >
              <option value="PRIVATE">Private — requester, assignee, admins and the people below</option>
              <option value="TEAM">Team — also everyone in a chosen team</option>
            </select>
            {visibility === 'TEAM' && (
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">— team —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            <button
              className="btn"
              disabled={busy || (visibility === 'TEAM' && !teamId) || visUnchanged}
              onClick={saveVisibility}
            >
              Save
            </button>
          </div>
        </>
      )}

      <ul className="member-list" style={{ marginTop: 10 }}>
        {followers.map((f) => (
          <li key={f.id}>
            <span>{f.user.fullName}</span>
            {canManage && f.user.id !== ticket.requester.id && (
              <button className="btn tiny" disabled={busy} onClick={() => removePerson(f.user.id)}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <div className="add-row">
          <select value={addId} onChange={(e) => setAddId(e.target.value)}>
            <option value="">Add a person who can see this…</option>
            {people
              .filter((p) => !followers.some((f) => f.user.id === p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>{p.fullName}</option>
              ))}
          </select>
          <button className="btn primary" disabled={busy || !addId} onClick={addPerson}>
            Add
          </button>
        </div>
      )}
      {note && <p className="muted small" style={{ margin: '8px 0 0' }}>{note}</p>}
      <ErrorText>{error}</ErrorText>
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
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api(`/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          subject,
          description: description || undefined,
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
      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}
