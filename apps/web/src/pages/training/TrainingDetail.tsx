import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import type { Training, UserLookup } from '../../types'
import { ErrorText } from '../../ui'
import { Chatter, EntityAttachments, EntityAudit } from '../../components/entity-panels'

const STATUS = [
  { key: 'requested', label: 'Requested' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'Training In Progress' },
  { key: 'trainer_checklist', label: 'Trainer Checklist' },
  { key: 'waiting_ack', label: 'Waiting for Acknowledgement' },
  { key: 'completed', label: 'Completed' },
]
const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS.map((s) => [s.key, s.label]),
)
const TRANSITIONS: Record<string, string[]> = {
  requested: ['scheduled'],
  scheduled: ['in_progress', 'requested'],
  in_progress: ['trainer_checklist', 'scheduled'],
  trainer_checklist: ['waiting_ack', 'in_progress'],
  waiting_ack: ['completed', 'trainer_checklist'],
  completed: ['waiting_ack'],
}
const trainingNo = (n: number) => `TRN-${String(n).padStart(4, '0')}`
const ACK_LABEL: Record<string, string> = {
  PENDING: 'no response',
  CONFIRMED: 'confirmed',
  NEEDS_FOLLOW_UP: 'needs follow-up',
}

type Tab = 'details' | 'discussion' | 'history'
const TAB_LABEL: Record<Tab, string> = {
  details: 'Details',
  discussion: 'Discussion',
  history: 'Activity',
}

export default function TrainingDetail({
  id,
  onBack,
}: {
  id: string
  onBack: () => void
}) {
  const { user } = useAuth()
  const isAdmin = !!user?.roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN')
  const [t, setT] = useState<Training | null>(null)
  const [people, setPeople] = useState<UserLookup[]>([])
  const [tab, setTab] = useState<Tab>('details')
  const [error, setError] = useState<string | null>(null)
  const [newItem, setNewItem] = useState('')
  const [ackComment, setAckComment] = useState('')

  const isManager =
    !!t && (isAdmin || t.trainer.id === user!.id || t.createdBy.id === user!.id)
  const myParticipant = t?.participants.find((p) => p.user.id === user!.id)

  async function load() {
    try {
      setT(await api<Training>(`/trainings/${id}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load training')
    }
  }
  useEffect(() => {
    void load()
    void api<UserLookup[]>('/users/lookup').then(setPeople)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function changeStatus(statusKey: string) {
    setError(null)
    try {
      await api(`/trainings/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ statusKey }),
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change status')
    }
  }
  async function toggleItem(itemId: string, done: boolean) {
    await api(`/trainings/${id}/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ done }),
    })
    void load()
  }
  async function addItem() {
    if (!newItem.trim()) return
    await api(`/trainings/${id}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ label: newItem }),
    })
    setNewItem('')
    void load()
  }
  async function removeItem(itemId: string) {
    await api(`/trainings/${id}/checklist/${itemId}`, { method: 'DELETE' })
    void load()
  }
  async function addParticipant(userId: string) {
    if (!userId) return
    await api(`/trainings/${id}/participants`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
    void load()
  }
  async function removeParticipant(userId: string) {
    await api(`/trainings/${id}/participants/${userId}`, { method: 'DELETE' })
    void load()
  }
  async function acknowledge(result: 'CONFIRMED' | 'NEEDS_FOLLOW_UP') {
    setError(null)
    try {
      await api(`/trainings/${id}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ result, comment: ackComment || undefined }),
      })
      setAckComment('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit')
    }
  }

  if (error && !t) {
    return (
      <div>
        <button className="btn" onClick={onBack}>← Back</button>
        <p className="error-text" style={{ marginTop: 16 }}>{error}</p>
      </div>
    )
  }
  if (!t) return <p className="muted">Loading…</p>

  const memberIds = new Set(t.participants.map((p) => p.user.id))
  const doneCount = t.checklist.filter((c) => c.done).length

  return (
    <div>
      <button className="btn" onClick={onBack}>← All training</button>

      <div className="page-head" style={{ marginTop: 14 }}>
        <div>
          <h1>
            <span className="muted">{trainingNo(t.number)}</span> {t.topic}
          </h1>
          <p className="muted small">
            {t.type === 'GROUP' ? 'Group' : 'Individual'} · trainer {t.trainer.fullName}
            {t.scheduledAt &&
              ` · ${new Date(t.scheduledAt).toLocaleString()}`}
          </p>
        </div>
      </div>

      <div className="status-bar">
        <span className="badge warn">{STATUS_LABEL[t.statusKey] ?? t.statusKey}</span>
        {isManager && (TRANSITIONS[t.statusKey] ?? []).length > 0 && (
          <select
            defaultValue=""
            onChange={(e) => e.target.value && changeStatus(e.target.value)}
          >
            <option value="" disabled>Move to…</option>
            {(TRANSITIONS[t.statusKey] ?? []).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
            ))}
          </select>
        )}
        {t.completedAt && (
          <span className="muted small">
            Completed {new Date(t.completedAt).toLocaleDateString()}
          </span>
        )}
      </div>
      <ErrorText>{error}</ErrorText>

      {myParticipant &&
        t.statusKey === 'waiting_ack' &&
        myParticipant.ackStatus === 'PENDING' && (
          <div className="rsvp-bar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <b>Did you complete this training?</b>
            <textarea
              rows={2}
              placeholder="Comment (optional)"
              value={ackComment}
              onChange={(e) => setAckComment(e.target.value)}
              style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: 8, font: 'inherit', fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" onClick={() => acknowledge('CONFIRMED')}>
                Confirm completed
              </button>
              <button className="btn" onClick={() => acknowledge('NEEDS_FOLLOW_UP')}>
                Need follow-up
              </button>
            </div>
          </div>
        )}
      {myParticipant && myParticipant.ackStatus !== 'PENDING' && (
        <p className="muted small">
          Your acknowledgement: <b>{ACK_LABEL[myParticipant.ackStatus]}</b>
          {myParticipant.ackComment && ` — “${myParticipant.ackComment}”`}
        </p>
      )}

      <div className="tabs" style={{ marginTop: 14 }}>
        {(['details', 'discussion', 'history'] as Tab[]).map((x) => (
          <button
            key={x}
            className={`tab ${tab === x ? 'active' : ''}`}
            onClick={() => setTab(x)}
          >
            {TAB_LABEL[x]}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="detail-grid" style={{ marginTop: 14 }}>
          <div className="card">
            <h3>Participants</h3>
            <table className="grid">
              <tbody>
                {t.participants.map((p) => (
                  <tr key={p.id}>
                    <td>{p.user.fullName}</td>
                    <td style={{ width: 130 }}>
                      <span
                        className={`badge ${
                          p.ackStatus === 'CONFIRMED'
                            ? 'ok'
                            : p.ackStatus === 'NEEDS_FOLLOW_UP'
                              ? 'warn'
                              : 'muted'
                        }`}
                      >
                        {ACK_LABEL[p.ackStatus]}
                      </span>
                    </td>
                    {isManager && (
                      <td style={{ width: 70 }}>
                        <button
                          className="btn tiny"
                          onClick={() => removeParticipant(p.user.id)}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {isManager && (
              <select
                value=""
                onChange={(e) => addParticipant(e.target.value)}
                style={{ marginTop: 8 }}
              >
                <option value="">+ Add participant…</option>
                {people
                  .filter((p) => !memberIds.has(p.id) && p.id !== t.trainer.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.fullName}</option>
                  ))}
              </select>
            )}

            {t.description && (
              <>
                <h3 style={{ marginTop: 16 }}>About</h3>
                <p>{t.description}</p>
              </>
            )}
          </div>

          <div className="card">
            <h3>
              Trainer checklist ({doneCount}/{t.checklist.length})
            </h3>
            {t.checklist.length === 0 && (
              <p className="muted small">No checklist items yet.</p>
            )}
            <ul className="mini-list">
              {t.checklist.map((c) => (
                <li key={c.id}>
                  <label className="checkbox" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={c.done}
                      disabled={!isManager}
                      onChange={(e) => toggleItem(c.id, e.target.checked)}
                    />
                    <span
                      style={{
                        textDecoration: c.done ? 'line-through' : 'none',
                        color: c.done ? 'var(--text-muted)' : 'inherit',
                      }}
                    >
                      {c.label}
                    </span>
                  </label>
                  {isManager && (
                    <button className="btn tiny" onClick={() => removeItem(c.id)}>
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isManager && (
              <div className="inline-form">
                <input
                  placeholder="New checklist item…"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem()}
                  style={{ flex: 1 }}
                />
                <button className="btn primary" disabled={!newItem.trim()} onClick={addItem}>
                  Add
                </button>
              </div>
            )}

            <h3 style={{ marginTop: 20 }}>Materials</h3>
            <EntityAttachments entityType="trainings" entityId={id} />
          </div>
        </div>
      )}
      {tab === 'discussion' && (
        <div style={{ marginTop: 14 }}>
          <Chatter entityType="trainings" entityId={id} />
        </div>
      )}
      {tab === 'history' && (
        <div style={{ marginTop: 14 }}>
          <EntityAudit entityType="trainings" entityId={id} />
        </div>
      )}
    </div>
  )
}
