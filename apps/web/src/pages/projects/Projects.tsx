import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import type { Project, UserLookup } from '../../types'
import { Modal, Field, ErrorText } from '../../ui'
import ProjectDetail from './ProjectDetail'

const PRJ_LABEL: Record<string, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  at_risk: 'At Risk',
  delayed: 'Delayed',
  on_hold: 'On Hold',
  completed: 'Completed',
}
const projectNo = (n: number) => `PRJ-${String(n).padStart(4, '0')}`

export default function Projects({
  initialProjectId,
  onConsumed,
}: {
  initialProjectId?: string | null
  onConsumed?: () => void
} = {}) {
  const [openId, setOpenId] = useState<string | null>(initialProjectId ?? null)
  const [rows, setRows] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (initialProjectId) {
      setOpenId(initialProjectId)
      onConsumed?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId])

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('statusKey', statusFilter)
      if (q.trim()) params.set('q', q.trim())
      const qs = params.toString()
      setRows(await api<Project[]>(`/projects${qs ? `?${qs}` : ''}`))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (openId) return
    const t = setTimeout(() => void load(), 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, q, openId])

  if (openId) {
    return <ProjectDetail id={openId} onBack={() => setOpenId(null)} />
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="muted">
            Objective-driven work with tasks over time. You see projects you own
            or are a member of.
          </p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + New project
        </button>
      </div>

      <div className="filters">
        <input
          placeholder="Search title / description…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Any status</option>
          {Object.entries(PRJ_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No projects yet.</p>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>ID</th>
              <th>Project</th>
              <th>Owner</th>
              <th>Progress</th>
              <th>Target</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} onClick={() => setOpenId(p.id)}>
                <td><b>{projectNo(p.number)}</b></td>
                <td>{p.title}</td>
                <td>{p.owner.fullName}</td>
                <td>
                  <div className="progress-wrap small">
                    <div
                      className="progress-bar"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                  <span className="muted small">{p.progress}%</span>
                </td>
                <td className="muted small">
                  {p.targetDate
                    ? new Date(p.targetDate).toLocaleDateString()
                    : '—'}
                </td>
                <td>
                  <span className={`badge status-${p.statusKey}`}>
                    {PRJ_LABEL[p.statusKey] ?? p.statusKey}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <NewProjectModal
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

function NewProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [types, setTypes] = useState<{ key: string; label: string }[]>([])
  const [people, setPeople] = useState<UserLookup[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void api<{ values: { key: string; label: string }[] }>('/master-data/project_types')
      .then((r) => setTypes(r.values))
      .catch(() => {})
    void api<UserLookup[]>('/users/lookup').then(setPeople)
  }, [])

  function toggleMember(id: string) {
    setMemberIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    )
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const created = await api<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          title,
          type,
          description: description || undefined,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
          memberIds,
        }),
      })
      onCreated(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create project')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New project"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            onClick={save}
            disabled={busy || title.trim().length < 3 || !type}
          >
            {busy ? 'Creating…' : 'Create project'}
          </button>
        </>
      }
    >
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Type">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">— choose —</option>
          {types.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Description">
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Target date">
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      </Field>
      <div className="field">
        <span className="field-label">Team members (you are the owner)</span>
        <div className="role-grid">
          {people
            .filter((p) => p.id !== user!.id)
            .map((p) => (
              <label key={p.id} className="checkbox">
                <input
                  type="checkbox"
                  checked={memberIds.includes(p.id)}
                  onChange={() => toggleMember(p.id)}
                />
                {p.fullName}
              </label>
            ))}
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}
