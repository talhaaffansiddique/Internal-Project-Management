import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import type { Meeting, Project, UserLookup } from '../../types'
import { Modal, Field, ErrorText } from '../../ui'
import MeetingDetail from './MeetingDetail'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function ymd(d: Date) {
  // local date key (not UTC) so calendar cells match the viewer's timezone
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function Meetings() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const range = useMemo(() => {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59)
    return { from, to }
  }, [cursor])

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      })
      setMeetings(await api<Meeting[]>(`/meetings?${params.toString()}`))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (openId) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, openId])

  if (openId) {
    return <MeetingDetail id={openId} onBack={() => setOpenId(null)} />
  }

  // build calendar grid (Mon-first)
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const startPad = (first.getDay() + 6) % 7 // 0 = Monday
  const daysInMonth = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0,
  ).getDate()

  const byDay: Record<string, Meeting[]> = {}
  for (const m of meetings) {
    const key = ymd(new Date(m.startsAt))
    ;(byDay[key] ??= []).push(m)
  }

  const cells: (Date | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d))
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const todayKey = ymd(new Date())
  const upcoming = [...meetings]
    .filter((m) => new Date(m.endsAt) >= new Date())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Meetings &amp; Calendar</h1>
          <p className="muted">Meetings you organize or are invited to.</p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + New meeting
        </button>
      </div>

      <div className="cal-head">
        <button
          className="btn"
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
        >
          ‹
        </button>
        <b>
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </b>
        <button
          className="btn"
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
        >
          ›
        </button>
        <button
          className="btn"
          onClick={() => setCursor(startOfMonth(new Date()))}
        >
          Today
        </button>
        {loading && <span className="muted small">loading…</span>}
      </div>

      <div className="calendar">
        {DOW.map((d) => (
          <div key={d} className="cal-cell cal-dow">{d}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="cal-cell cal-empty" />
          const key = ymd(date)
          return (
            <div
              key={i}
              className={`cal-cell ${key === todayKey ? 'cal-today' : ''}`}
            >
              <div className="cal-daynum">{date.getDate()}</div>
              {(byDay[key] ?? []).map((m) => (
                <button
                  key={m.id}
                  className="cal-evt"
                  onClick={() => setOpenId(m.id)}
                  title={m.title}
                >
                  {new Date(m.startsAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  {m.title}
                </button>
              ))}
            </div>
          )
        })}
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h3>Upcoming this month</h3>
        <div className="panel-body">
          {upcoming.length === 0 ? (
            <p className="muted small" style={{ padding: '10px 16px' }}>
              Nothing upcoming.
            </p>
          ) : (
            <table className="grid">
              <tbody>
                {upcoming.map((m) => (
                  <tr key={m.id} onClick={() => setOpenId(m.id)}>
                    <td style={{ width: 180 }} className="muted small">
                      {new Date(m.startsAt).toLocaleString()}
                    </td>
                    <td>{m.title}</td>
                    <td className="muted small">{m.organizer.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {creating && (
        <NewMeetingModal
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

function NewMeetingModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [agenda, setAgenda] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('10:30')
  const [location, setLocation] = useState('')
  const [onlineLink, setOnlineLink] = useState('')
  const [projectId, setProjectId] = useState('')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [people, setPeople] = useState<UserLookup[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void api<UserLookup[]>('/users/lookup').then(setPeople)
    void api<Project[]>('/projects').then(setProjects).catch(() => {})
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
      const startsAt = new Date(`${date}T${startTime}`).toISOString()
      const endsAt = new Date(`${date}T${endTime}`).toISOString()
      const created = await api<Meeting>('/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title,
          agenda: agenda || undefined,
          startsAt,
          endsAt,
          location: location || undefined,
          onlineLink: onlineLink || undefined,
          projectId: projectId || undefined,
          participantIds,
        }),
      })
      onCreated(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create meeting')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New meeting"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            onClick={save}
            disabled={busy || title.trim().length < 3 || !date}
          >
            {busy ? 'Creating…' : 'Create meeting'}
          </button>
        </>
      }
    >
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="Start"><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
        <Field label="End"><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>
      </div>
      <Field label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
      <Field label="Online link"><input value={onlineLink} onChange={(e) => setOnlineLink(e.target.value)} placeholder="https://…" /></Field>
      <Field label="Related project (optional)">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">— none —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </Field>
      <Field label="Agenda">
        <textarea rows={2} value={agenda} onChange={(e) => setAgenda(e.target.value)} />
      </Field>
      <div className="field">
        <span className="field-label">Participants</span>
        <div className="role-grid">
          {people
            .filter((p) => p.id !== user!.id)
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
