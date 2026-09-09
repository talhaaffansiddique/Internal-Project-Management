import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import type { UserLookup } from '../types'
import { Modal, Field, ErrorText } from '../ui'

interface Activity {
  id: string
  title: string
  status: 'OPEN' | 'DONE' | 'CANCELLED'
  dueAt: string
  completedAt: string | null
  assignedTo: { id: string; fullName: string }
  createdBy: { id: string; fullName: string }
  entityType: string | null
}

export default function MyWork() {
  const [rows, setRows] = useState<Activity[]>([])
  const [includeDone, setIncludeDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setRows(
        await api<Activity[]>(`/me/activities?includeDone=${includeDone}`),
      )
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeDone])

  async function complete(id: string) {
    await api(`/activities/${id}/complete`, { method: 'POST' })
    void load()
  }

  const overdue = (a: Activity) =>
    a.status === 'OPEN' && new Date(a.dueAt).getTime() < Date.now()

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>My Work</h1>
          <p className="muted">Follow-ups and activities assigned to you.</p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + New activity
        </button>
      </div>

      <label className="checkbox" style={{ marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={includeDone}
          onChange={(e) => setIncludeDone(e.target.checked)}
        />
        Show completed
      </label>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">Nothing here. Enjoy the quiet.</p>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>Activity</th>
              <th>Due</th>
              <th>Assigned by</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><b>{a.title}</b>{a.entityType && <div className="muted small">on {a.entityType.toLowerCase()}</div>}</td>
                <td className={overdue(a) ? 'bad' : ''}>
                  {new Date(a.dueAt).toLocaleString()}
                  {overdue(a) && ' · overdue'}
                </td>
                <td>{a.createdBy.fullName}</td>
                <td>
                  <span className={`badge ${a.status === 'DONE' ? 'ok' : 'warn'}`}>
                    {a.status.toLowerCase()}
                  </span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {a.status === 'OPEN' && (
                    <button className="btn tiny" onClick={() => complete(a.id)}>
                      Mark done
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <ActivityModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            void load()
          }}
        />
      )}
    </div>
  )
}

function ActivityModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [assignedToId, setAssignedToId] = useState(user!.id)
  const [dueAt, setDueAt] = useState('')
  const [people, setPeople] = useState<UserLookup[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void api<UserLookup[]>('/users/lookup').then(setPeople)
  }, [])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api('/activities', {
        method: 'POST',
        body: JSON.stringify({
          title,
          assignedToId,
          dueAt: new Date(dueAt).toISOString(),
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
      title="New activity"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            onClick={save}
            disabled={busy || !title.trim() || !dueAt}
          >
            {busy ? 'Saving…' : 'Create'}
          </button>
        </>
      }
    >
      <Field label="What needs doing?">
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Assign to">
        <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
              {p.id === user!.id ? ' (me)' : ''}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Due">
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}
