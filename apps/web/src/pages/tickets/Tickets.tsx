import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { Team, Ticket, TicketForm } from '../../types'
import { Modal, Field, ErrorText } from '../../ui'
import TicketDetail from './TicketDetail'

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  waiting_for_user: 'Waiting for User',
  resolved: 'Resolved',
  closed: 'Closed',
}
const ticketNo = (n: number) => `TKT-${String(n).padStart(4, '0')}`

const VIEWS = [
  ['all', 'All'],
  ['mine', 'My Tickets'],
  ['team', 'Team'],
  ['unassigned', 'Unassigned'],
] as const

export default function Tickets() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [rows, setRows] = useState<Ticket[]>([])
  const [forms, setForms] = useState<TicketForm[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<(typeof VIEWS)[number][0]>('all')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ view })
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('statusKey', statusFilter)
      if (q.trim()) params.set('q', q.trim())
      setRows(await api<Ticket[]>(`/tickets?${params.toString()}`))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void api<TicketForm[]>('/ticket-forms').then(setForms)
  }, [])

  useEffect(() => {
    if (openId) return
    const t = setTimeout(() => void load(), 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, typeFilter, statusFilter, q, openId])

  if (openId) {
    return <TicketDetail id={openId} onBack={() => setOpenId(null)} />
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Tickets &amp; Requests</h1>
          <p className="muted">
            You see tickets you raised, are assigned, follow, or that are shared
            with your team.
          </p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + New request
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: 12 }}>
        {VIEWS.map(([key, label]) => (
          <button
            key={key}
            className={`tab ${view === key ? 'active' : ''}`}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="filters">
        <input
          placeholder="Search subject / description…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {forms.map((f) => (
            <option key={f.type} value={f.type}>{f.label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Any status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No tickets here.</p>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>ID</th>
              <th>Subject</th>
              <th>Type</th>
              <th>Requester</th>
              <th>Assignee</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} onClick={() => setOpenId(t.id)}>
                <td><b>{ticketNo(t.number)}</b></td>
                <td>
                  {t.subject}
                  {t.visibility === 'TEAM' && (
                    <span className="badge muted" style={{ marginLeft: 6 }}>
                      {t.team?.name}
                    </span>
                  )}
                </td>
                <td>{forms.find((f) => f.type === t.type)?.label ?? t.type}</td>
                <td>{t.requester.fullName}</td>
                <td>{t.assignee?.fullName ?? <span className="muted">—</span>}</td>
                <td>{t.priority ?? <span className="muted">—</span>}</td>
                <td>
                  <span className="badge warn">
                    {STATUS_LABEL[t.statusKey] ?? t.statusKey}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <NewTicketModal
          forms={forms}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            setOpenId(id)
          }}
        />
      )}
    </div>
  )
}

function NewTicketModal({
  forms,
  onClose,
  onCreated,
}: {
  forms: TicketForm[]
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [type, setType] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [visibility, setVisibility] = useState<'PRIVATE' | 'TEAM'>('PRIVATE')
  const [teamId, setTeamId] = useState('')
  const [priority, setPriority] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [priorities, setPriorities] = useState<{ key: string; label: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void api<Team[]>('/teams').then(setTeams)
    void api<{ values: { key: string; label: string }[] }>('/master-data/priorities')
      .then((r) => setPriorities(r.values))
      .catch(() => {})
  }, [])

  const form = forms.find((f) => f.type === type)

  function setField(name: string, value: string) {
    setFields((cur) => ({ ...cur, [name]: value }))
  }

  const missingRequired =
    !!form &&
    form.fields.some((f) => f.required && !fields[f.name]?.trim())

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const created = await api<Ticket>('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          type,
          description: description || undefined,
          fields,
          visibility,
          teamId: visibility === 'TEAM' ? teamId : undefined,
          priority: priority || undefined,
        }),
      })
      onCreated(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create ticket')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New request"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            onClick={save}
            disabled={
              busy ||
              !type ||
              subject.trim().length < 3 ||
              missingRequired ||
              (visibility === 'TEAM' && !teamId)
            }
          >
            {busy ? 'Creating…' : 'Create ticket'}
          </button>
        </>
      }
    >
      <Field label="Request type">
        <select value={type} onChange={(e) => { setType(e.target.value); setFields({}) }}>
          <option value="">— choose —</option>
          {forms.map((f) => (
            <option key={f.type} value={f.type}>{f.label}</option>
          ))}
        </select>
      </Field>

      {type && (
        <>
          <Field label="Subject">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>

          {form?.fields.map((f) => (
            <Field key={f.name} label={f.label + (f.required ? ' *' : '')} hint={f.help}>
              {f.type === 'textarea' ? (
                <textarea
                  rows={2}
                  value={fields[f.name] ?? ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                />
              ) : f.type === 'select' ? (
                <select
                  value={fields[f.name] ?? ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                >
                  <option value="">— choose —</option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={fields[f.name] ?? ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                />
              )}
            </Field>
          ))}

          <Field label="More detail (optional)">
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          <Field label="Who can see this?">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'PRIVATE' | 'TEAM')}
            >
              <option value="PRIVATE">Private — me, assignee, admins, followers</option>
              <option value="TEAM">Team — also everyone in a chosen team</option>
            </select>
          </Field>
          {visibility === 'TEAM' && (
            <Field label="Team">
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">— choose team —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Priority (optional)">
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">— leave blank —</option>
              {priorities.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </Field>
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}
