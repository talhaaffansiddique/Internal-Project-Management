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
            {rows.map((r) => (
              <tr key={r.id} onClick={() => setOpenId(r.id)}>
                <td><b>{prNo(r.number)}</b></td>
                <td>{r.itemDescription}</td>
                <td>{r.type === 'PRODUCT' ? 'Product' : 'Service'}</td>
                <td>{r.requester.fullName}</td>
                <td className="muted small">{r.department?.name ?? '—'}</td>
                <td className="muted small">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <span className="badge warn">{STATUS_LABEL[r.statusKey]}</span>
                </td>
              </tr>
            ))}
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

function NewProcurementModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [type, setType] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT')
  const [itemDescription, setItemDescription] = useState('')
  const [businessReason, setBusinessReason] = useState('')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const created = await api<ProcurementRequest>('/procurement-requests', {
        method: 'POST',
        body: JSON.stringify({
          type,
          itemDescription,
          businessReason,
          quantity: quantity || undefined,
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
            disabled={busy || itemDescription.trim().length < 3 || businessReason.trim().length < 3}
          >
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </>
      }
    >
      <Field label="Product or service?">
        <select value={type} onChange={(e) => setType(e.target.value as 'PRODUCT' | 'SERVICE')}>
          <option value="PRODUCT">Product</option>
          <option value="SERVICE">Service</option>
        </select>
      </Field>
      <Field label="Item / service description">
        <textarea rows={2} value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} />
      </Field>
      <Field label="Business reason">
        <textarea rows={2} value={businessReason} onChange={(e) => setBusinessReason(e.target.value)} />
      </Field>
      <Field label="Quantity" hint="Optional — if applicable">
        <input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}
