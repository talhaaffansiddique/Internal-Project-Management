import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { Department } from '../../types'
import { Modal, Field, ErrorText } from '../../ui'

export default function Departments() {
  const [rows, setRows] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Department | 'new' | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRows(await api<Department[]>('/departments?includeInactive=true'))
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
          <h1>Departments</h1>
          <p className="muted">Organizational units. Referenced by users and teams.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}>
          + New department
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Users</th>
              <th>Teams</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} onClick={() => setEditing(d)}>
                <td><b>{d.name}</b>{d.notes && <div className="muted small">{d.notes}</div>}</td>
                <td>{d.code ?? '—'}</td>
                <td>{d._count?.members ?? 0}</td>
                <td>{d._count?.teams ?? 0}</td>
                <td>{d.active ? 'Yes' : <span className="muted">No</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <DepartmentModal
          value={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

function DepartmentModal({
  value,
  onClose,
  onSaved,
}: {
  value: Department | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(value?.name ?? '')
  const [code, setCode] = useState(value?.code ?? '')
  const [notes, setNotes] = useState(value?.notes ?? '')
  const [active, setActive] = useState(value?.active ?? true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const body = { name, code: code || undefined, notes: notes || undefined, active }
      if (value) {
        await api(`/departments/${value.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await api('/departments', { method: 'POST', body: JSON.stringify(body) })
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={value ? `Edit ${value.name}` : 'New department'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Code" hint="Short code, e.g. FIN">
        <input value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      {value && (
        <label className="checkbox">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
      )}
      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}
