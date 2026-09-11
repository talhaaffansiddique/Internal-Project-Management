import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { ProcurementRequest } from '../../types'
import { Modal, Field, ErrorText } from '../../ui'
import ProcurementDetail from './ProcurementDetail'

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Awaiting Supervisor',
  AWAITING_DIRECTOR: 'Awaiting Director',
  WITH_PURCHASING: 'With Purchasing',
  ORDERED: 'Ordered',
  DELIVERED: 'Delivered',
  REJECTED: 'Rejected',
}
const prNo = (n: number) => `PR-${String(n).padStart(4, '0')}`

export default function Procurement() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [rows, setRows] = useState<ProcurementRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('statusKey', statusFilter)
      if (typeFilter) params.set('type', typeFilter)
      const qs = params.toString()
      setRows(await api<ProcurementRequest[]>(`/procurement-requests${qs ? `?${qs}` : ''}`))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (openId) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter, openId])

  if (openId) {
    return <ProcurementDetail id={openId} onBack={() => setOpenId(null)} />
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Procurement</h1>
          <p className="muted">
            Employee → Supervisor → (Director or Purchasing/Finance) → Purchasing/Finance.
          </p>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + New request
        </button>
      </div>

      <div className="filters">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Any type</option>
          <option value="PRODUCT">Product</option>
          <option value="SERVICE">Service</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Any stage</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No procurement requests visible to you.</p>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>ID</th>
              <th>Item / Service</th>
              <th>Type</th>
              <th>Requester</th>
              <th>Department</th>
              <th>Created</th>
              <th>Stage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const [first, ...rest] = r.items
              const types = [...new Set(r.items.map((i) => i.type))]
              return (
                <tr key={r.id} onClick={() => setOpenId(r.id)}>
                  <td><b>{prNo(r.number)}</b></td>
                  <td>
                    {first?.description ?? '—'}
                    {rest.length > 0 && (
                      <span className="muted small"> +{rest.length} more</span>
                    )}
                  </td>
                  <td>
                    {types.length > 1
                      ? 'Mixed'
                      : types[0] === 'PRODUCT'
                        ? 'Product'
                        : 'Service'}
                  </td>
                  <td>{r.requester.fullName}</td>
                  <td className="muted small">{r.department?.name ?? '—'}</td>
                  <td className="muted small">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <span className="badge warn">{STATUS_LABEL[r.statusKey]}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {creating && (
        <NewProcurementModal
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

interface DraftItem {
  type: 'PRODUCT' | 'SERVICE'
  description: string
  quantity: string
}
const emptyItem = (): DraftItem => ({ type: 'PRODUCT', description: '', quantity: '' })

function NewProcurementModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [items, setItems] = useState<DraftItem[]>([emptyItem()])
  const [businessReason, setBusinessReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function updateItem(i: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }
  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  const validItems = items.filter((it) => it.description.trim().length >= 3)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const created = await api<ProcurementRequest>('/procurement-requests', {
        method: 'POST',
        body: JSON.stringify({
          items: validItems.map((it) => ({
            type: it.type,
            description: it.description.trim(),
            quantity: it.quantity.trim() || undefined,
          })),
          businessReason,
        }),
      })
      onCreated(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New procurement request"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            onClick={save}
            disabled={busy || validItems.length === 0 || businessReason.trim().length < 3}
          >
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </>
      }
    >
      <Field label="Items / services needed">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'flex-start',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 8,
              }}
            >
              <select
                value={it.type}
                onChange={(e) => updateItem(i, { type: e.target.value as 'PRODUCT' | 'SERVICE' })}
                style={{ width: 90 }}
              >
                <option value="PRODUCT">Product</option>
                <option value="SERVICE">Service</option>
              </select>
              <input
                placeholder="Description"
                value={it.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                style={{ flex: 2 }}
              />
              <input
                placeholder="Qty"
                value={it.quantity}
                onChange={(e) => updateItem(i, { quantity: e.target.value })}
                style={{ width: 70 }}
              />
              <button
                type="button"
                className="btn ghost"
                onClick={() => removeItem(i)}
                disabled={items.length === 1}
                title="Remove item"
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn" onClick={addItem}>
            + Add another item
          </button>
        </div>
      </Field>
      <Field label="Business reason">
        <textarea rows={2} value={businessReason} onChange={(e) => setBusinessReason(e.target.value)} />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}
