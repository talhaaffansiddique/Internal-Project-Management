import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import type {
  Branch,
  Designation,
  MasterDataType,
  MasterDataValue,
} from '../../types'
import { Modal, Field, ErrorText } from '../../ui'

type Selection =
  | { kind: 'designation' }
  | { kind: 'branch' }
  | { kind: 'generic'; type: MasterDataType }

interface Row {
  id: string
  label: string
  sub?: string
  active: boolean
  isSystem: boolean
  parentId?: string | null
  key?: string
}

export default function MasterData() {
  const { user } = useAuth()
  const canWrite = !!user?.roles.includes('SUPER_ADMIN')

  const [types, setTypes] = useState<MasterDataType[]>([])
  const [sel, setSel] = useState<Selection>({ kind: 'designation' })
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Row | 'new' | null>(null)

  useEffect(() => {
    void api<MasterDataType[]>('/master-data/types').then(setTypes)
  }, [])

  const typeKey = sel.kind === 'generic' ? sel.type.key : null
  const allowsHierarchy = sel.kind === 'generic' && sel.type.allowsHierarchy

  async function load() {
    setLoading(true)
    try {
      if (sel.kind === 'generic') {
        const res = await api<{ values: MasterDataValue[] }>(
          `/master-data/${sel.type.key}?includeInactive=true`,
        )
        const labelById = new Map(res.values.map((v) => [v.id, v.label]))
        setRows(
          res.values.map((v) => ({
            id: v.id,
            label: v.label,
            key: v.key,
            active: v.active,
            isSystem: v.isSystem,
            parentId: v.parentId,
            sub: v.parentId ? `under ${labelById.get(v.parentId) ?? '?'}` : undefined,
          })),
        )
      } else if (sel.kind === 'designation') {
        const list = await api<Designation[]>('/designations?includeInactive=true')
        setRows(
          list.map((d) => ({
            id: d.id,
            label: d.name,
            active: d.active ?? true,
            isSystem: false,
          })),
        )
      } else {
        const list = await api<Branch[]>('/branches?includeInactive=true')
        setRows(
          list.map((b) => ({
            id: b.id,
            label: b.name,
            sub: b.address ?? undefined,
            active: b.active,
            isSystem: false,
          })),
        )
      }
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    setEditing(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel])

  async function move(index: number, dir: -1 | 1) {
    if (!typeKey) return
    const next = [...rows]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setRows(next)
    await api(`/master-data/${typeKey}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ orderedIds: next.map((r) => r.id) }),
    })
  }

  const title =
    sel.kind === 'generic'
      ? sel.type.name
      : sel.kind === 'designation'
        ? 'Designations'
        : 'Branches'

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Master Data</h1>
          <p className="muted">
            Configurable lists. A Super Admin adds values here with no code change.
          </p>
        </div>
      </div>

      <div className="md-layout">
        <nav className="md-nav">
          <div className="side-group">Organisation</div>
          <button
            className={`md-item ${sel.kind === 'designation' ? 'active' : ''}`}
            onClick={() => setSel({ kind: 'designation' })}
          >
            Designations
          </button>
          <button
            className={`md-item ${sel.kind === 'branch' ? 'active' : ''}`}
            onClick={() => setSel({ kind: 'branch' })}
          >
            Branches
          </button>
          <div className="side-group">Lists</div>
          {types.map((t) => (
            <button
              key={t.id}
              className={`md-item ${typeKey === t.key ? 'active' : ''}`}
              onClick={() => setSel({ kind: 'generic', type: t })}
            >
              {t.name}
              <span className="md-count">{t._count?.values ?? 0}</span>
            </button>
          ))}
        </nav>

        <section className="md-panel">
          <div className="md-panel-head">
            <h2>{title}</h2>
            {canWrite && (
              <button className="btn primary" onClick={() => setEditing('new')}>
                + Add value
              </button>
            )}
          </div>

          {loading ? (
            <p className="muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="muted">No values yet.</p>
          ) : (
            <table className="grid">
              <thead>
                <tr>
                  {typeKey && <th style={{ width: 70 }}>Order</th>}
                  <th>Label</th>
                  {sel.kind === 'generic' && <th>Key</th>}
                  <th style={{ width: 90 }}>Active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} onClick={() => canWrite && setEditing(r)}>
                    {typeKey && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn tiny"
                          disabled={i === 0 || !canWrite}
                          onClick={() => move(i, -1)}
                        >
                          ↑
                        </button>{' '}
                        <button
                          className="btn tiny"
                          disabled={i === rows.length - 1 || !canWrite}
                          onClick={() => move(i, 1)}
                        >
                          ↓
                        </button>
                      </td>
                    )}
                    <td>
                      <b>{r.label}</b>
                      {r.sub && <div className="muted small">{r.sub}</div>}
                      {r.isSystem && <span className="badge muted" style={{ marginLeft: 6 }}>system</span>}
                    </td>
                    {sel.kind === 'generic' && <td className="muted small">{r.key}</td>}
                    <td>{r.active ? 'Yes' : <span className="muted">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {editing && (
        <ValueModal
          kind={sel.kind}
          typeKey={typeKey}
          allowsHierarchy={allowsHierarchy}
          parentOptions={rows.filter((r) => !r.parentId)}
          value={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
            void api<MasterDataType[]>('/master-data/types').then(setTypes)
          }}
        />
      )}
    </div>
  )
}

function ValueModal({
  kind,
  typeKey,
  allowsHierarchy,
  parentOptions,
  value,
  onClose,
  onSaved,
}: {
  kind: Selection['kind']
  typeKey: string | null
  allowsHierarchy: boolean
  parentOptions: Row[]
  value: Row | null
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !value
  const [label, setLabel] = useState(value?.label ?? '')
  const [address, setAddress] = useState(value?.sub ?? '')
  const [parentId, setParentId] = useState(value?.parentId ?? '')
  const [active, setActive] = useState(value?.active ?? true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const base =
    kind === 'generic'
      ? `/master-data/${typeKey}`
      : kind === 'designation'
        ? '/designations'
        : '/branches'

  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (kind === 'generic') {
        const body = isNew
          ? { label, parentId: parentId || undefined }
          : { label, active, parentId: parentId || null }
        await api(isNew ? base : `${base}/${value!.id}`, {
          method: isNew ? 'POST' : 'PATCH',
          body: JSON.stringify(body),
        })
      } else if (kind === 'designation') {
        const body = isNew ? { name: label } : { name: label, active }
        await api(isNew ? base : `${base}/${value!.id}`, {
          method: isNew ? 'POST' : 'PATCH',
          body: JSON.stringify(body),
        })
      } else {
        const body = isNew
          ? { name: label, address: address || undefined }
          : { name: label, address: address || undefined, active }
        await api(isNew ? base : `${base}/${value!.id}`, {
          method: isNew ? 'POST' : 'PATCH',
          body: JSON.stringify(body),
        })
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!value) return
    setBusy(true)
    setError(null)
    try {
      await api(`${base}/${value.id}`, { method: 'DELETE' })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const canDelete = value && !value.isSystem

  return (
    <Modal
      title={isNew ? 'Add value' : `Edit ${value.label}`}
      onClose={onClose}
      footer={
        <>
          {canDelete && (
            <button className="btn danger" onClick={remove} disabled={busy} style={{ marginRight: 'auto' }}>
              Delete
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy || !label.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <Field label={kind === 'generic' ? 'Label' : 'Name'}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>

      {kind === 'branch' && (
        <Field label="Address">
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
      )}

      {kind === 'generic' && allowsHierarchy && (
        <Field label="Sub-value of" hint="Optional — leave blank for a top-level value">
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— none —</option>
            {parentOptions
              .filter((o) => o.id !== value?.id)
              .map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
          </select>
        </Field>
      )}

      {!isNew && (
        <label className="checkbox">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
      )}
      {!isNew && value.key && (
        <p className="muted small">Key: <code>{value.key}</code> (fixed)</p>
      )}
      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}
