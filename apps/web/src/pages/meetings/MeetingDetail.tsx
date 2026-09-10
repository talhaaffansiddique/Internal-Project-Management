import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import type { Meeting, MeetingResponseValue, UserLookup } from '../../types'
import { ErrorText } from '../../ui'
import { EntityAttachments } from '../../components/entity-panels'

const RSVP_LABEL: Record<MeetingResponseValue, string> = {
  PENDING: 'No response',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  TENTATIVE: 'Tentative',
}
const meetingNo = (n: number) => `MTG-${String(n).padStart(4, '0')}`

interface ActionItem {
  id: string
  title: string
  status: string
  dueAt: string
  assignedTo: { fullName: string }
}

export default function MeetingDetail({
  id,
  onBack,
}: {
  id: string
  onBack: () => void
}) {
  const { user } = useAuth()
  const isAdmin = !!user?.roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN')
  const [m, setM] = useState<Meeting | null>(null)
  const [items, setItems] = useState<ActionItem[]>([])
  const [people, setPeople] = useState<UserLookup[]>([])
  const [minutes, setMinutes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isOrganizer = !!m && (isAdmin || m.organizer.id === user!.id)
  const me = m?.participants.find((p) => p.user.id === user!.id)

  async function load() {
    try {
      const data = await api<Meeting>(`/meetings/${id}`)
      setM(data)
      setMinutes(data.minutes ?? '')
      setItems(await api<ActionItem[]>(`/meetings/${id}/action-items`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load meeting')
    }
  }
  useEffect(() => {
    void load()
    void api<UserLookup[]>('/users/lookup').then(setPeople)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function rsvp(response: MeetingResponseValue) {
    await api(`/meetings/${id}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    })
    void load()
  }
  async function toggleAttended(userId: string, attended: boolean) {
    await api(`/meetings/${id}/attendance`, {
      method: 'POST',
      body: JSON.stringify({ attendance: [{ userId, attended }] }),
    })
    void load()
  }
  async function saveMinutes() {
    await api(`/meetings/${id}/minutes`, {
      method: 'PUT',
      body: JSON.stringify({ minutes }),
    })
    void load()
  }
  async function cancelMeeting() {
    if (!confirm('Cancel this meeting? Participants will be notified.')) return
    await api(`/meetings/${id}`, { method: 'DELETE' })
    onBack()
  }

  if (error) {
    return (
      <div>
        <button className="btn" onClick={onBack}>← Back</button>
        <p className="error-text" style={{ marginTop: 16 }}>{error}</p>
      </div>
    )
  }
  if (!m) return <p className="muted">Loading…</p>

  return (
    <div>
      <button className="btn" onClick={onBack}>← Calendar</button>

      <div className="page-head" style={{ marginTop: 14 }}>
        <div>
          <h1>
            <span className="muted">{meetingNo(m.number)}</span> {m.title}
          </h1>
          <p className="muted small">
            {new Date(m.startsAt).toLocaleString()} –{' '}
            {new Date(m.endsAt).toLocaleTimeString()} · organizer {m.organizer.fullName}
          </p>
        </div>
        {isOrganizer && (
          <button className="btn danger" onClick={cancelMeeting}>Cancel meeting</button>
        )}
      </div>

      {me && me.response === 'PENDING' && (
        <div className="rsvp-bar">
          <span>Will you attend?</span>
          <button className="btn" onClick={() => rsvp('ACCEPTED')}>Accept</button>
          <button className="btn" onClick={() => rsvp('TENTATIVE')}>Maybe</button>
          <button className="btn" onClick={() => rsvp('DECLINED')}>Decline</button>
        </div>
      )}
      {me && me.response !== 'PENDING' && (
        <p className="muted small">
          Your response: <b>{RSVP_LABEL[me.response]}</b>{' '}
          <button className="linklike" onClick={() => rsvp('PENDING')}>change</button>
        </p>
      )}

      <div className="detail-grid" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="kv">
            <span>When</span>
            <b>{new Date(m.startsAt).toLocaleString()}</b>
            <span>Where</span>
            <b>
              {m.location || m.onlineLink ? (
                <>
                  {m.location}
                  {m.onlineLink && (
                    <>
                      {m.location ? ' · ' : ''}
                      <a href={m.onlineLink} target="_blank" rel="noreferrer">
                        online link
                      </a>
                    </>
                  )}
                </>
              ) : (
                <span className="muted">—</span>
              )}
            </b>
            <span>Project</span>
            <b>{m.project ? m.project.title : <span className="muted">—</span>}</b>
          </div>

          {m.agenda && (
            <>
              <h3>Agenda</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{m.agenda}</p>
            </>
          )}

          <h3 style={{ marginTop: 16 }}>Participants</h3>
          <table className="grid">
            <tbody>
              {m.participants.map((p) => (
                <tr key={p.id}>
                  <td>{p.user.fullName}</td>
                  <td style={{ width: 110 }}>
                    <span
                      className={`badge ${
                        p.response === 'ACCEPTED'
                          ? 'ok'
                          : p.response === 'DECLINED'
                            ? 'warn'
                            : 'muted'
                      }`}
                    >
                      {RSVP_LABEL[p.response].toLowerCase()}
                    </span>
                  </td>
                  {isOrganizer && (
                    <td style={{ width: 90 }}>
                      <label className="checkbox" style={{ margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={p.attended}
                          onChange={(e) =>
                            toggleAttended(p.user.id, e.target.checked)
                          }
                        />
                        attended
                      </label>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Minutes</h3>
          <textarea
            rows={5}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="Notes from the meeting…"
            style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: 8, font: 'inherit', fontSize: 13 }}
          />
          <button
            className="btn primary"
            style={{ marginTop: 8 }}
            onClick={saveMinutes}
          >
            Save minutes
          </button>

          <h3 style={{ marginTop: 20 }}>Action items</h3>
          {items.length === 0 && <p className="muted small">None yet.</p>}
          <ul className="mini-list">
            {items.map((a) => (
              <li key={a.id}>
                <span>
                  <b>{a.title}</b>
                  <span className="muted small">
                    {' '}
                    · {a.assignedTo.fullName} · due{' '}
                    {new Date(a.dueAt).toLocaleDateString()}
                  </span>
                </span>
                <span
                  className={`badge ${a.status === 'DONE' ? 'ok' : 'warn'}`}
                >
                  {a.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
          <ActionItemForm
            people={people}
            defaultAssignee={user!.id}
            onAdd={async (dto) => {
              await api(`/meetings/${id}/action-items`, {
                method: 'POST',
                body: JSON.stringify(dto),
              })
              void load()
            }}
          />

          <h3 style={{ marginTop: 20 }}>Files</h3>
          <EntityAttachments entityType="meetings" entityId={id} />
        </div>
      </div>
    </div>
  )
}

function ActionItemForm({
  people,
  defaultAssignee,
  onAdd,
}: {
  people: UserLookup[]
  defaultAssignee: string
  onAdd: (dto: { title: string; assignedToId: string; dueAt: string }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [assignedToId, setAssignedToId] = useState(defaultAssignee)
  const [dueAt, setDueAt] = useState('')
  const [err, setErr] = useState<string | null>(null)

  return (
    <div className="inline-form" style={{ marginTop: 8 }}>
      <input
        placeholder="Action item…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ flexBasis: '100%' }}
      />
      <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
        {people.map((p) => (
          <option key={p.id} value={p.id}>{p.fullName}</option>
        ))}
      </select>
      <input
        type="datetime-local"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
      />
      <button
        className="btn primary"
        disabled={!title.trim() || !dueAt}
        onClick={async () => {
          setErr(null)
          try {
            await onAdd({
              title,
              assignedToId,
              dueAt: new Date(dueAt).toISOString(),
            })
            setTitle('')
            setDueAt('')
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'Failed')
          }
        }}
      >
        Add
      </button>
      <ErrorText>{err}</ErrorText>
    </div>
  )
}
