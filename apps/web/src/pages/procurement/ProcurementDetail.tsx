import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import type { ProcurementRequest } from '../../types'
import { ErrorText } from '../../ui'
import { Chatter, EntityAttachments, EntityAudit } from '../../components/entity-panels'

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Awaiting Supervisor',
  AWAITING_DIRECTOR: 'Awaiting Director',
  WITH_PURCHASING: 'With Purchasing',
  ORDERED: 'Ordered',
  DELIVERED: 'Delivered',
  REJECTED: 'Rejected',
}
const prNo = (n: number) => `PR-${String(n).padStart(4, '0')}`

type Tab = 'details' | 'discussion' | 'files' | 'history'

export default function ProcurementDetail({
  id,
  onBack,
}: {
  id: string
  onBack: () => void
}) {
  const { user } = useAuth()
  const isAdmin = !!user?.roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN')
  const isSupervisor = isAdmin || !!user?.roles.includes('SUPERVISOR')
  const isDirector = isAdmin || !!user?.roles.includes('DIRECTOR')
  const isPurchasing = isAdmin || !!user?.roles.includes('PURCHASING_FINANCE')

  const [r, setR] = useState<ProcurementRequest | null>(null)
  const [tab, setTab] = useState<Tab>('details')
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [amount, setAmount] = useState('')
  const [terms, setTerms] = useState('')
  const [delivery, setDelivery] = useState('')

  async function load() {
    try {
      setR(await api<ProcurementRequest>(`/procurement-requests/${id}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load request')
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function act(path: string, body: Record<string, unknown>) {
    setError(null)
    try {
      await api(`/procurement-requests/${id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setComment('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    }
  }

  async function addQuotation() {
    if (!vendorName.trim() || !amount) return
    setError(null)
    try {
      await api(`/procurement-requests/${id}/quotations`, {
        method: 'POST',
        body: JSON.stringify({
          vendorName,
          amount: Number(amount),
          paymentTerms: terms || undefined,
          deliveryTime: delivery || undefined,
        }),
      })
      setVendorName('')
      setAmount('')
      setTerms('')
      setDelivery('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add quotation')
    }
  }

  async function selectQuotation(qid: string) {
    await api(`/procurement-quotations/${qid}/select`, { method: 'POST' })
    void load()
  }

  if (error && !r) {
    return (
      <div>
        <button className="btn" onClick={onBack}>← Back</button>
        <p className="error-text" style={{ marginTop: 16 }}>{error}</p>
      </div>
    )
  }
  if (!r) return <p className="muted">Loading…</p>

  return (
    <div>
      <button className="btn" onClick={onBack}>← All requests</button>

      <div className="page-head" style={{ marginTop: 14 }}>
        <div>
          <h1>
            <span className="muted">{prNo(r.number)}</span> {r.itemDescription}
          </h1>
          <p className="muted small">
            {r.type === 'PRODUCT' ? 'Product' : 'Service'} · requested by{' '}
            {r.requester.fullName}
            {r.department && ` · ${r.department.name}`}
          </p>
        </div>
      </div>

      <div className="status-bar">
        <span className="badge warn">{STATUS_LABEL[r.statusKey]}</span>
      </div>

      {r.statusKey === 'SUBMITTED' && isSupervisor && (
        <div className="rsvp-bar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <b>Supervisor review</b>
          <textarea
            rows={2}
            placeholder="Comment (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: 8, font: 'inherit', fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={() => act('supervisor-decision', { decision: 'approve_to_purchasing', comment })}>
              Approve to Purchasing
            </button>
            <button className="btn" onClick={() => act('supervisor-decision', { decision: 'forward_to_director', comment })}>
              Forward to Director
            </button>
            <button className="btn danger" onClick={() => act('supervisor-decision', { decision: 'reject', comment })}>
              Reject
            </button>
          </div>
        </div>
      )}

      {r.statusKey === 'AWAITING_DIRECTOR' && isDirector && (
        <div className="rsvp-bar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <b>Director approval</b>
          <textarea
            rows={2}
            placeholder="Comment (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: 8, font: 'inherit', fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" onClick={() => act('director-decision', { decision: 'approve', comment })}>
              Approve
            </button>
            <button className="btn danger" onClick={() => act('director-decision', { decision: 'reject', comment })}>
              Reject
            </button>
          </div>
        </div>
      )}

      {r.statusKey === 'WITH_PURCHASING' && isPurchasing && (
        <div className="rsvp-bar">
          <button
            className="btn primary"
            onClick={() => act('purchase-status', { statusKey: 'ORDERED' })}
          >
            Mark order placed
          </button>
          <span className="muted small">requires a selected quotation</span>
        </div>
      )}
      {r.statusKey === 'ORDERED' && isPurchasing && (
        <div className="rsvp-bar">
          <button
            className="btn primary"
            onClick={() => act('purchase-status', { statusKey: 'DELIVERED' })}
          >
            Mark delivered
          </button>
        </div>
      )}
      <ErrorText>{error}</ErrorText>

      <div className="tabs" style={{ marginTop: 14 }}>
        {(['details', 'discussion', 'files', 'history'] as Tab[]).map((x) => (
          <button
            key={x}
            className={`tab ${tab === x ? 'active' : ''}`}
            onClick={() => setTab(x)}
          >
            {x[0].toUpperCase() + x.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="detail-grid" style={{ marginTop: 14 }}>
          <div className="card">
            <div className="kv">
              <span>Quantity</span>
              <b>{r.quantity ?? <span className="muted">—</span>}</b>
              <span>Business reason</span>
              <b style={{ fontWeight: 400 }}>{r.businessReason}</b>
              <span>Created</span>
              <b>{new Date(r.createdAt).toLocaleString()}</b>
            </div>
          </div>

          <div className="card">
            <h3>Vendor quotations</h3>
            {r.quotations.length === 0 ? (
              <p className="muted small">No quotations yet.</p>
            ) : (
              <table className="grid">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Amount</th>
                    <th>Terms</th>
                    <th>Delivery</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {r.quotations.map((q) => (
                    <tr key={q.id}>
                      <td>{q.vendorName}</td>
                      <td>${q.amount.toLocaleString()}</td>
                      <td className="muted small">{q.paymentTerms ?? '—'}</td>
                      <td className="muted small">{q.deliveryTime ?? '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {q.status === 'SELECTED' ? (
                          <span className="badge ok">selected</span>
                        ) : q.status === 'REJECTED' ? (
                          <span className="badge muted">rejected</span>
                        ) : r.statusKey === 'WITH_PURCHASING' && isPurchasing ? (
                          <button className="btn tiny" onClick={() => selectQuotation(q.id)}>
                            Select
                          </button>
                        ) : (
                          <span className="badge muted">pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {r.statusKey === 'WITH_PURCHASING' && isPurchasing && (
              <div style={{ marginTop: 12 }}>
                <div className="inline-form">
                  <input placeholder="Vendor" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
                  <input placeholder="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 90 }} />
                  <input placeholder="Payment terms" value={terms} onChange={(e) => setTerms(e.target.value)} />
                  <input placeholder="Delivery time" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
                  <button className="btn primary" onClick={addQuotation} disabled={!vendorName.trim() || !amount}>
                    Add quotation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {tab === 'discussion' && (
        <div style={{ marginTop: 14 }}>
          <Chatter entityType="procurement-requests" entityId={id} />
        </div>
      )}
      {tab === 'files' && (
        <div style={{ marginTop: 14 }}>
          <EntityAttachments entityType="procurement-requests" entityId={id} />
        </div>
      )}
      {tab === 'history' && (
        <div style={{ marginTop: 14 }}>
          <EntityAudit entityType="procurement-requests" entityId={id} />
        </div>
      )}
    </div>
  )
}
