import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import type { Training, UserLookup } from '../../types'
import { Modal, Field, ErrorText } from '../../ui'
import TrainingDetail from './TrainingDetail'

const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  trainer_checklist: 'Trainer Checklist',
  waiting_ack: 'Waiting for Acknowledgement',
  completed: 'Completed',
}
const trainingNo = (n: number) => `TRN-${String(n).padStart(4, '0')}`

export default function Training() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [rows, setRows] = useState<Training[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('statusKey', statusFilter)
      if (q.trim()) params.set('q', q.trim())
      const qs = params.toString()
      setRows(await api<Training[]>(`/trainings${qs ? `?${qs}` : ''}`))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (openId) return
    const tmr = setTimeout(() => void load(), 200)
    return () => clearTimeout(tmr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, q, openId])

  if (openId) {
    return <TrainingDetail id={openId} onBack={() => setOpenId(null)} />
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Training</h1>
          <p className="muted">
            Sessions you run or attend. Completion needs every participant to
            acknowledge.
          </p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + New training
        </button>
      </div>

      <div className="filters">
        <input
          placeholder="Search topic…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
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
        <p className="muted">No training sessions.</p>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>ID</th>
              <th>Topic</th>
              <th>Trainer</th>
              <th>Participants</th>
              <th>Scheduled</th>
              <th>Created</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const confirmed = t.participants.filter(
                (p) => p.ackStatus === 'CONFIRMED',
              ).length
              return (
                <tr key={t.id} onClick={() => setOpenId(t.id)}>
                  <td><b>{trainingNo(t.number)}</b></td>
                  <td>{t.topic}</td>
                  <td>{t.trainer.fullName}</td>
                  <td>
                    {t.participants.length}
                    {t.statusKey === 'waiting_ack' && (
                      <span className="muted small">
                        {' '}
                        · {confirmed}/{t.participants.length} confirmed
                      </span>
                    )}
                  </td>
                  <td className="muted small">
                    {t.scheduledAt
                      ? new Date(t.scheduledAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="muted small">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <span className="badge warn">
                      {STATUS_LABEL[t.statusKey] ?? t.statusKey}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {creating && (
        <NewTrainingModal
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

function NewTrainingModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { user } = useAuth()
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [categoryKey, setCategoryKey] = useState('')
  const [type, setType] = useState<'GROUP' | 'INDIVIDUAL'>('GROUP')
  const [trainerId, setTrainerId] = useState(user!.id)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('14:00')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [checklistText, setChecklistText] = useState('')
  const [categories, setCategories] = useState<{ key: string; label: string }[]>([])
  const [people, setPeople] = useState<UserLookup[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void api<{ values: { key: string; label: string }[] }>(
      '/master-data/training_categories',
    )
      .then((r) => setCategories(r.values))
      .catch(() => {})
    void api<UserLookup[]>('/users/lookup').then(setPeople)
  }, [])

  function toggle(id: string) {
    setParticipantIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    )
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const created = await api<Training>('/trainings', {
        method: 'POST',
        body: JSON.stringify({
          topic,
          description: description || undefined,
          categoryKey: categoryKey || undefined,
          type,
          trainerId,
          scheduledAt: date
            ? new Date(`${date}T${time}`).toISOString()
            : undefined,
          participantIds,
          checklist: checklistText
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
        }),
      })
      onCreated(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create training')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New training"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            onClick={save}
            disabled={busy || topic.trim().length < 3}
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </>
      }
    >
      <Field label="Topic">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} />
      </Field>
      <Field label="Category">
        <select value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)}>
          <option value="">— none —</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Type">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'GROUP' | 'INDIVIDUAL')}
        >
          <option value="GROUP">Group</option>
          <option value="INDIVIDUAL">Individual</option>
        </select>
      </Field>
      <Field label="Trainer">
        <select value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
              {p.id === user!.id ? ' (me)' : ''}
            </option>
          ))}
        </select>
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <Field label="Description">
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Checklist" hint="One item per line">
        <textarea
          rows={3}
          value={checklistText}
          onChange={(e) => setChecklistText(e.target.value)}
        />
      </Field>
      <div className="field">
        <span className="field-label">Participants</span>
        <div className="role-grid">
          {people
            .filter((p) => p.id !== trainerId)
            .map((p) => (
              <label key={p.id} className="checkbox">
                <input
                  type="checkbox"
                  checked={participantIds.includes(p.id)}
                  onChange={() => toggle(p.id)}
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
