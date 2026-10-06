import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import type { Ticket, TicketForm } from '../../types'
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
const STATUS_ORDER = Object.keys(STATUS_LABEL)
type SortKey = 'id' | 'type' | 'requester' | 'assignee' | 'created' | 'status'
const ticketNo = (n: number) => `TKT-${String(n).padStart(4, '0')}`

const VIEWS = [
  ['all', 'All'],
  ['mine', 'My Tickets'],
  ['team', 'Team'],
  ['unassigned', 'Unassigned'],
] as const

export default function Tickets({
  initialTicketId,
  onConsumed,
}: {
  initialTicketId?: string | null
  onConsumed?: () => void
} = {}) {
  const { user } = useAuth()
  const isErpUser = !!user?.isErpUser
  const [openId, setOpenId] = useState<string | null>(initialTicketId ?? null)

  useEffect(() => {
    if (initialTicketId) {
      setOpenId(initialTicketId)
      onConsumed?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTicketId])
  const [rows, setRows] = useState<Ticket[]>([])
  const [forms, setForms] = useState<TicketForm[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<(typeof VIEWS)[number][0]>('all')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null)

  function toggleSort(key: SortKey) {
    setSort((cur) =>
      cur?.key === key ? (cur.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 },
    )
  }
  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const typeLabel = (t: Ticket) => forms.find((f) => f.type === t.type)?.label ?? t.type
    const val = (t: Ticket): string | number => {
      switch (sort.key) {
        case 'id': return t.number
        case 'type': return typeLabel(t).toLowerCase()
        case 'requester': return t.requester.fullName.toLowerCase()
        case 'assignee': return t.assignee?.fullName.toLowerCase() ?? ''
        case 'created': return new Date(t.createdAt).getTime()
        case 'status': return STATUS_ORDER.indexOf(t.statusKey)
      }
    }
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b)
      // unassigned always sinks to the bottom regardless of direction
      if (sort.key === 'assignee' && (x === '') !== (y === '')) return x === '' ? 1 : -1
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
    })
  }, [rows, sort, forms])
  const th = (key: SortKey, label: string) => (
    <th
      className="sortable"
      onClick={() => toggleSort(key)}
      aria-sort={sort?.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      <span className="sort-ind">
        {sort?.key === key ? (sort.dir === 1 ? '▲' : '▼') : '↕'}
      </span>
    </th>
  )

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
        <button
          className="btn primary"
          onClick={() => setCreating(true)}
          disabled={!isErpUser}
          title={isErpUser ? undefined : 'Only ERP users can raise an ERP complaint — ask an admin to mark you as an ERP user.'}
        >
          + ERP complaint form
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
              {th('id', 'ID')}
              <th>Subject</th>
              {th('type', 'Type')}
              {th('requester', 'Requester')}
              {th('assignee', 'Assignee')}
              {th('created', 'Created')}
              {th('status', 'Status')}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((t) => (
              <tr key={t.id} onClick={() => setOpenId(t.id)}>
                <td><b className="mono">{ticketNo(t.number)}</b></td>
                <td>
                  {t.subject}
                  {t.erpTicketNumber && (
                    <span className="badge ok" style={{ marginLeft: 6 }}>
                      ERP #{t.erpTicketNumber}
                    </span>
                  )}
                  {t.visibility === 'TEAM' && (
                    <span className="badge muted" style={{ marginLeft: 6 }}>
                      {t.team?.name}
                    </span>
                  )}
                </td>
                <td>{forms.find((f) => f.type === t.type)?.label ?? t.type}</td>
                <td>{t.requester.fullName}</td>
                <td>{t.assignee?.fullName ?? <span className="muted">—</span>}</td>
                <td className="muted small">
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <span className={`badge status-${t.statusKey}`}>
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

const MAX_FILE_BYTES = 50 * 1024 * 1024

async function uploadToTicket(ticketId: string, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/v1/attachments', {
    method: 'POST',
    body: fd,
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`Could not upload "${file.name}"`)
  const created = (await res.json()) as { id: string }
  await api(`/tickets/${ticketId}/attachments`, {
    method: 'POST',
    body: JSON.stringify({ attachmentId: created.id }),
  })
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
  const form = forms.find((f) => f.type === 'erp_issue')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function setField(name: string, value: string) {
    setFields((cur) => ({ ...cur, [name]: value }))
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    const picked = Array.from(list)
    const tooBig = picked.find((f) => f.size > MAX_FILE_BYTES)
    if (tooBig) {
      setError(`"${tooBig.name}" is larger than 50 MB.`)
      return
    }
    setError(null)
    setFiles((cur) => [...cur, ...picked])
  }

  const missingRequired =
    !form || form.fields.some((f) => f.required && !fields[f.name]?.trim())

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const created = await api<Ticket>('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          type: 'erp_issue',
          description: description || undefined,
          fields,
        }),
      })
      let failed: string | null = null
      for (const file of files) {
        try {
          await uploadToTicket(created.id, file)
        } catch (e) {
          failed = e instanceof Error ? e.message : 'Upload failed'
        }
      }
      if (failed) {
        alert(`Your complaint was created, but a file did not upload (${failed}). You can add it from the Files tab.`)
      }
      onCreated(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit the complaint')
      setBusy(false)
    }
  }

  return (
    <Modal
      title="ERP complaint form"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            onClick={save}
            disabled={busy || subject.trim().length < 3 || missingRequired}
          >
            {busy ? 'Submitting…' : 'Submit complaint'}
          </button>
        </>
      }
    >
      <Field label="Subject *">
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

      <div className="field">
        <span className="field-label">Screenshot or short video (optional)</span>
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <span className="field-hint">An image or a short clip showing the issue. Up to 50 MB each.</span>
        {files.length > 0 && (
          <ul className="mini-list" style={{ marginTop: 8 }}>
            {files.map((f, i) => (
              <li key={i}>
                <span>{f.name} <span className="muted small">· {(f.size / 1024 / 1024).toFixed(1)} MB</span></span>
                <button
                  className="btn tiny"
                  type="button"
                  onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}
