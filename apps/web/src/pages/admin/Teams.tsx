import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { Department, Team, TeamDetail, UserLookup } from '../../types'
import { Modal, Field, ErrorText } from '../../ui'

export default function Teams() {
  const [rows, setRows] = useState<Team[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [t, d] = await Promise.all([
        api<Team[]>('/teams?includeInactive=true'),
        api<Department[]>('/departments'),
      ])
      setRows(t)
      setDepartments(d)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Teams</h1>
          <p className="muted">Working groups that control shared record visibility.</p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + New team
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Members</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} onClick={() => setOpenId(t.id)}>
                <td><b>{t.name}</b>{t.description && <div className="muted small">{t.description}</div>}</td>
                <td>{t.department?.name ?? '—'}</td>
                <td>{t._count?.members ?? 0}</td>
                <td>{t.active ? 'Yes' : <span className="muted">No</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <TeamCreateModal
          departments={departments}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            void load()
          }}
        />
      )}
      {openId && (
        <TeamDetailModal
          teamId={openId}
          departments={departments}
          onClose={() => {
            setOpenId(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

function TeamCreateModal({
  departments,
  onClose,
  onSaved,
}: {
  departments: Department[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api('/teams', {
        method: 'POST',
        body: JSON.stringify({
          name,
          departmentId: departmentId || undefined,
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
      title="New team"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Create'}
          </button>
        </>
      }
    >
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Department" hint="Optional — teams can be cross-department">
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">— none —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}

function TeamDetailModal({
  teamId,
  departments,
  onClose,
}: {
  teamId: string
  departments: Department[]
  onClose: () => void
}) {
  const [team, setTeam] = useState<TeamDetail | null>(null)
  const [options, setOptions] = useState<UserLookup[]>([])
  const [addUserId, setAddUserId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [t, users] = await Promise.all([
      api<TeamDetail>(`/teams/${teamId}`),
      api<UserLookup[]>('/users/lookup'),
    ])
    setTeam(t)
    setOptions(users)
  }
  useEffect(() => {
    void load()
  }, [teamId])

  async function addMember() {
    if (!addUserId) return
    setBusy(true)
    setError(null)
    try {
      await api(`/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: addUserId }),
      })
      setAddUserId('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add member')
    } finally {
      setBusy(false)
    }
  }

  async function removeMember(userId: string) {
    setBusy(true)
    try {
      await api(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' })
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive() {
    if (!team) return
    await api(`/teams/${teamId}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !team.active }),
    })
    await load()
  }

  const memberIds = new Set(team?.members.map((m) => m.id))
  const selectable = options.filter((o) => !memberIds.has(o.id))

  return (
    <Modal title={team ? team.name : 'Team'} onClose={onClose}>
      {!team ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <p className="muted small">
            {team.department?.name ?? 'No department'}
            {' · '}
            {departments.length ? '' : ''}
            {team.active ? 'active' : 'inactive'}
            {' · '}
            <button className="linklike" onClick={toggleActive}>
              {team.active ? 'deactivate' : 'reactivate'}
            </button>
          </p>

          <h4 className="mt">Members ({team.members.length})</h4>
          {team.members.length === 0 && <p className="muted small">No members yet.</p>}
          <ul className="member-list">
            {team.members.map((m) => (
              <li key={m.membershipId}>
                <span>{m.fullName} <span className="muted small">{m.email}</span></span>
                <button className="btn tiny" disabled={busy} onClick={() => removeMember(m.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <div className="add-row">
            <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
              <option value="">— select user —</option>
              {selectable.map((o) => (
                <option key={o.id} value={o.id}>{o.fullName} ({o.email})</option>
              ))}
            </select>
            <button className="btn primary" disabled={busy || !addUserId} onClick={addMember}>
              Add
            </button>
          </div>
          <ErrorText>{error}</ErrorText>
        </>
      )}
    </Modal>
  )
}
