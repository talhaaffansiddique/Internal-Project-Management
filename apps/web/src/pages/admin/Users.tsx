import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import type {
  AdminUser,
  Department,
  Designation,
  Role,
  UserLookup,
  UserStatus,
} from '../../types'
import { Modal, Field, ErrorText, StatusBadge } from '../../ui'

interface RefData {
  roles: Role[]
  departments: Department[]
  designations: Designation[]
  users: UserLookup[]
}

export default function Users() {
  const [rows, setRows] = useState<AdminUser[]>([])
  const [ref, setRef] = useState<RefData | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null)

  async function loadRef() {
    const [roles, departments, designations, users] = await Promise.all([
      api<Role[]>('/roles'),
      api<Department[]>('/departments'),
      api<Designation[]>('/designations'),
      api<UserLookup[]>('/users/lookup'),
    ])
    setRef({ roles, departments, designations, users })
  }

  async function loadUsers() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (deptFilter) params.set('departmentId', deptFilter)
      if (statusFilter) params.set('status', statusFilter)
      const qs = params.toString()
      setRows(await api<AdminUser[]>(`/users${qs ? `?${qs}` : ''}`))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRef()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void loadUsers(), 250)
    return () => clearTimeout(t)
  }, [q, deptFilter, statusFilter])

  function afterSave() {
    setEditing(null)
    void loadUsers()
    void loadRef()
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <p className="muted">Company employees and administrators.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing('new')} disabled={!ref}>
          + Invite user
        </button>
      </div>

      <div className="filters">
        <input
          placeholder="Search name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">All departments</option>
          {ref?.departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INVITED">Invited</option>
          <option value="DISABLED">Disabled</option>
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No users match.</p>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Roles</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} onClick={() => setEditing(u)}>
                <td><b>{u.fullName}</b>{u.designation && <div className="muted small">{u.designation.name}</div>}</td>
                <td>{u.email}</td>
                <td>{u.primaryDepartment?.name ?? '—'}</td>
                <td>{u.roles.map((r) => r.name).join(', ') || '—'}</td>
                <td><StatusBadge status={u.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && ref && (
        <UserModal
          value={editing === 'new' ? null : editing}
          ref_={ref}
          onClose={() => setEditing(null)}
          onSaved={afterSave}
        />
      )}
    </div>
  )
}

function UserModal({
  value,
  ref_,
  onClose,
  onSaved,
}: {
  value: AdminUser | null
  ref_: RefData
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !value
  const [fullName, setFullName] = useState(value?.fullName ?? '')
  const [email, setEmail] = useState(value?.email ?? '')
  const [password, setPassword] = useState('')
  const [departmentId, setDepartmentId] = useState(value?.primaryDepartment?.id ?? '')
  const [designationId, setDesignationId] = useState(value?.designation?.id ?? '')
  const [supervisorId, setSupervisorId] = useState(value?.supervisor?.id ?? '')
  const [status, setStatus] = useState<UserStatus>(value?.status ?? 'INVITED')
  const [roleKeys, setRoleKeys] = useState<string[]>(
    value?.roles.map((r) => r.key) ?? ['EMPLOYEE'],
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const originalRoleKeys = useMemo(
    () => (value?.roles.map((r) => r.key) ?? []).sort().join(','),
    [value],
  )

  function toggleRole(key: string) {
    setRoleKeys((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
    )
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (isNew) {
        await api('/users', {
          method: 'POST',
          body: JSON.stringify({
            fullName,
            email,
            password,
            primaryDepartmentId: departmentId || undefined,
            designationId: designationId || undefined,
            supervisorId: supervisorId || undefined,
            roleKeys,
          }),
        })
      } else {
        await api(`/users/${value.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fullName,
            primaryDepartmentId: departmentId || undefined,
            designationId: designationId || undefined,
            supervisorId: supervisorId || undefined,
          }),
        })
        if (status !== value.status) {
          await api(`/users/${value.id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
          })
        }
        if ([...roleKeys].sort().join(',') !== originalRoleKeys) {
          await api(`/users/${value.id}/roles`, {
            method: 'PATCH',
            body: JSON.stringify({ roleKeys }),
          })
        }
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const canSave =
    fullName.trim().length >= 2 &&
    (!isNew || (/.+@.+/.test(email) && password.length >= 8)) &&
    roleKeys.length > 0

  return (
    <Modal
      title={isNew ? 'Invite user' : `Edit ${value.fullName}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy || !canSave}>
            {busy ? 'Saving…' : isNew ? 'Invite' : 'Save'}
          </button>
        </>
      }
    >
      <Field label="Full name">
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </Field>

      {isNew ? (
        <>
          <Field label="Company email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Temporary password" hint="At least 8 characters. The user changes it after first login.">
            <input value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </>
      ) : (
        <Field label="Email">
          <input value={email} disabled />
        </Field>
      )}

      <Field label="Department">
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">— none —</option>
          {ref_.departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </Field>

      <Field label="Designation">
        <select value={designationId} onChange={(e) => setDesignationId(e.target.value)}>
          <option value="">— none —</option>
          {ref_.designations.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </Field>

      <Field label="Supervisor">
        <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
          <option value="">— none —</option>
          {ref_.users
            .filter((u) => u.id !== value?.id)
            .map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
        </select>
      </Field>

      {!isNew && (
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as UserStatus)}>
            <option value="ACTIVE">Active</option>
            <option value="INVITED">Invited</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </Field>
      )}

      <div className="field">
        <span className="field-label">Roles</span>
        <div className="role-grid">
          {ref_.roles.map((r) => (
            <label key={r.id} className="checkbox">
              <input
                type="checkbox"
                checked={roleKeys.includes(r.key)}
                onChange={() => toggleRole(r.key)}
              />
              {r.name}
            </label>
          ))}
        </div>
      </div>

      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}
