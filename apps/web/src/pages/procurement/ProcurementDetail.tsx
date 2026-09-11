import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import type { ProcurementItem, ProcurementQuotation, ProcurementRequest, UserLookup } from '../../types'
import { aed, ErrorText, Field, Modal } from '../../ui'
import { Chatter, EntityAttachments, EntityAudit } from '../../components/entity-panels'

async function uploadQuoteFile(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/v1/attachments', {
    method: 'POST',
    body: fd,
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Could not upload the quote file')
  const created = (await res.json()) as { id: string }
  return created.id
}

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Awaiting Supervisor',
  AWAITING_DIRECTOR: 'Awaiting Director',
  WITH_PURCHASING: 'With Purchasing',
  AWAITING_FINAL_APPROVAL: 'Awaiting Final Approval',
  ORDERED: 'Ordered',
  DELIVERED: 'Delivered',
  REJECTED: 'Rejected',
}
const prNo = (n: number) => `PR-${String(n).padStart(4, '0')}`
const textAreaStyle = {
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  padding: 8,
  font: 'inherit',
  fontSize: 13,
  background: 'var(--surface)',
  color: 'var(--text)',
} as const
const STOPPABLE_STAGES = ['WITH_PURCHASING', 'AWAITING_FINAL_APPROVAL', 'ORDERED']

type Tab = 'details' | 'discussion' | 'files' | 'history'
const TAB_LABEL: Record<Tab, string> = {
  details: 'Details',
  discussion: 'Discussion',
  files: 'Files',
  history: 'Activity',
}

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
  const isPurchasingRole = isAdmin || !!user?.roles.includes('PURCHASING_FINANCE')

  const [r, setR] = useState<ProcurementRequest | null>(null)
  const [tab, setTab] = useState<Tab>('details')
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [quoteModal, setQuoteModal] = useState<'add' | ProcurementQuotation | null>(null)
  const [viewQuote, setViewQuote] = useState<ProcurementQuotation | null>(null)
  const [purchasingUsers, setPurchasingUsers] = useState<UserLookup[]>([])
  const [showStop, setShowStop] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [stopComment, setStopComment] = useState('')
  const [reassignTo, setReassignTo] = useState('')
  const [reassignComment, setReassignComment] = useState('')

  // Only the assigned RFQ owner (if one is set) may act on Purchasing-stage
  // actions; otherwise it's open to any Purchasing/Finance user.
  const isPurchasing = r
    ? isAdmin || (r.assignedTo ? r.assignedTo.id === user?.id : isPurchasingRole)
    : isPurchasingRole

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
  useEffect(() => {
    if (isDirector) {
      void api<UserLookup[]>('/users/lookup?role=PURCHASING_FINANCE').then(setPurchasingUsers)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirector])

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

  async function selectQuotation(qid: string) {
    await api(`/procurement-quotations/${qid}/select`, { method: 'POST' })
    void load()
  }

  async function rejectQuotation(qid: string) {
    await api(`/procurement-quotations/${qid}/reject`, { method: 'POST' })
    void load()
  }

  function openQuote(q: ProcurementQuotation) {
    if (q.attachmentId) {
      window.open(`/api/v1/attachments/${q.attachmentId}/download`, '_blank')
    } else {
      setViewQuote(q)
    }
  }

  async function stopPurchase() {
    if (!stopComment.trim()) return
    setError(null)
    try {
      await api(`/procurement-requests/${id}/stop`, {
        method: 'POST',
        body: JSON.stringify({ comment: stopComment }),
      })
      setStopComment('')
      setShowStop(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop the purchase')
    }
  }

  async function reassign() {
    if (!reassignTo) return
    setError(null)
    try {
      await api(`/procurement-requests/${id}/reassign`, {
        method: 'POST',
        body: JSON.stringify({ assignedToId: reassignTo, comment: reassignComment || undefined }),
      })
      setReassignTo('')
      setReassignComment('')
      setShowReassign(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not re-assign the request')
    }
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
            <span className="muted">{prNo(r.number)}</span>{' '}
            {r.items[0]?.description ?? '—'}
            {r.items.length > 1 && (
              <span className="muted small"> +{r.items.length - 1} more</span>
            )}
          </h1>
          <p className="muted small">
            {[...new Set(r.items.map((i) => i.type))].length > 1
              ? 'Mixed'
              : r.items[0]?.type === 'PRODUCT'
                ? 'Product'
                : 'Service'}{' '}
            · requested by {r.requester.fullName}
            {r.department && ` · ${r.department.name}`}
            {r.assignedTo && ` · RFQ assigned to ${r.assignedTo.fullName}`}
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
            style={textAreaStyle}
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
            style={textAreaStyle}
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
            onClick={() => act('send-for-approval', { comment: comment || undefined })}
          >
            Send for director approval
          </button>
          <span className="muted small">requires a selected quotation</span>
        </div>
      )}

      {r.statusKey === 'AWAITING_FINAL_APPROVAL' && isDirector && (
        <div className="rsvp-bar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <b>Final approval — order the selected quotation?</b>
          <textarea
            rows={2}
            placeholder="Comment (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={textAreaStyle}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" onClick={() => act('final-approval', { decision: 'approve', comment })}>
              Approve & place order
            </button>
            <button className="btn danger" onClick={() => act('final-approval', { decision: 'reject', comment })}>
              Reject
            </button>
          </div>
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

      {isDirector && STOPPABLE_STAGES.includes(r.statusKey) && (
        <div className="rsvp-bar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <b>Director oversight</b>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn danger" onClick={() => { setShowStop((v) => !v); setShowReassign(false) }}>
              Stop purchase
            </button>
            <button className="btn" onClick={() => { setShowReassign((v) => !v); setShowStop(false) }}>
              Re-assign RFQ owner
            </button>
          </div>
          {showStop && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <textarea
                rows={2}
                placeholder="Reason for stopping this purchase (required)"
                value={stopComment}
                onChange={(e) => setStopComment(e.target.value)}
                style={textAreaStyle}
              />
              <button className="btn danger" onClick={stopPurchase} disabled={!stopComment.trim()} style={{ alignSelf: 'flex-start' }}>
                Confirm stop
              </button>
            </div>
          )}
          {showReassign && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                <option value="">— Choose new RFQ owner —</option>
                {purchasingUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
              <textarea
                rows={2}
                placeholder="Comment (optional)"
                value={reassignComment}
                onChange={(e) => setReassignComment(e.target.value)}
                style={textAreaStyle}
              />
              <button className="btn primary" onClick={reassign} disabled={!reassignTo} style={{ alignSelf: 'flex-start' }}>
                Confirm re-assignment
              </button>
            </div>
          )}
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
            {TAB_LABEL[x]}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="detail-grid" style={{ marginTop: 14 }}>
          <div className="card">
            <h3>Items / services</h3>
            <table className="grid">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {r.items.map((it) => (
                  <tr key={it.id}>
                    <td className="muted small">
                      {it.type === 'PRODUCT' ? 'Product' : 'Service'}
                    </td>
                    <td>{it.description}</td>
                    <td className="muted small">{it.quantity ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="kv" style={{ marginTop: 12 }}>
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
                      <td>
                        <button type="button" className="link-btn" onClick={() => openQuote(q)}>
                          {q.vendorName}
                        </button>
                        <div className="muted small">
                          by {q.createdBy.fullName}
                          {q.attachmentId ? ' · 📎 quote attached' : ''}
                        </div>
                      </td>
                      <td>{aed(q.amount)}</td>
                      <td className="muted small">{q.paymentTerms ?? '—'}</td>
                      <td className="muted small">{q.deliveryTime ?? '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {r.statusKey === 'WITH_PURCHASING' && isPurchasing ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            {q.status === 'SELECTED' && <span className="badge ok">selected</span>}
                            {q.status === 'REJECTED' && <span className="badge muted">rejected</span>}
                            {q.status === 'PENDING' && <span className="badge muted">pending</span>}
                            {q.status !== 'SELECTED' && (
                              <button className="btn tiny" onClick={() => selectQuotation(q.id)}>Select</button>
                            )}
                            {q.status !== 'REJECTED' && (
                              <button className="btn tiny ghost" onClick={() => rejectQuotation(q.id)}>Reject</button>
                            )}
                            <button className="btn tiny" onClick={() => setQuoteModal(q)}>Edit</button>
                          </div>
                        ) : q.status === 'SELECTED' ? (
                          <span className="badge ok">selected</span>
                        ) : q.status === 'REJECTED' ? (
                          <span className="badge muted">rejected</span>
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
                <button className="btn primary" onClick={() => setQuoteModal('add')}>
                  + Add quotation
                </button>
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

      {viewQuote && (
        <Modal
          title={`Quotation from ${viewQuote.vendorName}`}
          onClose={() => setViewQuote(null)}
          footer={<button className="btn" onClick={() => setViewQuote(null)}>Close</button>}
        >
          <p className="muted small">
            No document was attached to this quote — here's the per-item cost breakdown that
            was entered, to help you decide.
          </p>
          <table className="grid">
            <thead>
              <tr>
                <th>Type</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {viewQuote.lineItems.map((li) => (
                <tr key={li.id}>
                  <td className="muted small">{li.item.type === 'PRODUCT' ? 'Product' : 'Service'}</td>
                  <td>{li.item.description}</td>
                  <td className="muted small">{li.item.quantity ?? '—'}</td>
                  <td>{aed(li.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="kv" style={{ marginTop: 16 }}>
            <span>Total</span>
            <b>{aed(viewQuote.amount)}</b>
            <span>Payment terms</span>
            <b style={{ fontWeight: 400 }}>{viewQuote.paymentTerms ?? '—'}</b>
            <span>Delivery time</span>
            <b style={{ fontWeight: 400 }}>{viewQuote.deliveryTime ?? '—'}</b>
            <span>Comments</span>
            <b style={{ fontWeight: 400 }}>{viewQuote.comments ?? '—'}</b>
            <span>Added by</span>
            <b>{viewQuote.createdBy.fullName}</b>
          </div>
        </Modal>
      )}

      {quoteModal && (
        <QuotationFormModal
          requestId={id}
          items={r.items}
          existing={quoteModal === 'add' ? null : quoteModal}
          onClose={() => setQuoteModal(null)}
          onSaved={() => {
            setQuoteModal(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

function QuotationFormModal({
  requestId,
  items,
  existing,
  onClose,
  onSaved,
}: {
  requestId: string
  items: ProcurementItem[]
  existing: ProcurementQuotation | null
  onClose: () => void
  onSaved: () => void
}) {
  const [vendorName, setVendorName] = useState(existing?.vendorName ?? '')
  const [costs, setCosts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const it of items) {
      const line = existing?.lineItems.find((li) => li.itemId === it.id)
      initial[it.id] = line ? String(line.cost) : ''
    }
    return initial
  })
  const [terms, setTerms] = useState(existing?.paymentTerms ?? '')
  const [delivery, setDelivery] = useState(existing?.deliveryTime ?? '')
  const [comments, setComments] = useState(existing?.comments ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = items.reduce((sum, it) => sum + (Number(costs[it.id]) || 0), 0)
  const hasAnyCost = items.some((it) => Number(costs[it.id]) > 0)

  async function save() {
    if (!vendorName.trim() || !hasAnyCost) return
    setBusy(true)
    setError(null)
    try {
      const attachmentId = file ? await uploadQuoteFile(file) : undefined
      const payload = {
        vendorName: vendorName.trim(),
        items: items
          .filter((it) => Number(costs[it.id]) > 0)
          .map((it) => ({ itemId: it.id, cost: Number(costs[it.id]) })),
        paymentTerms: terms || undefined,
        deliveryTime: delivery || undefined,
        comments: comments || undefined,
        attachmentId,
      }
      if (existing) {
        await api(`/procurement-quotations/${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        await api(`/procurement-requests/${requestId}/quotations`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the quotation')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={existing ? `Edit quotation — ${existing.vendorName}` : 'Add a vendor quotation'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy || !vendorName.trim() || !hasAnyCost}>
            {busy ? 'Saving…' : existing ? 'Save changes' : 'Add quotation'}
          </button>
        </>
      }
    >
      <Field label="Vendor name">
        <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
      </Field>
      <Field
        label="Cost per item (AED)"
        hint="Enter what this vendor quoted for each item — the total is calculated automatically. Leave an item blank if this vendor doesn't cover it."
      >
        <table className="grid">
          <thead>
            <tr>
              <th>Type</th>
              <th>Item</th>
              <th>Qty</th>
              <th>Cost (AED)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td className="muted small">{it.type === 'PRODUCT' ? 'Product' : 'Service'}</td>
                <td>{it.description}</td>
                <td className="muted small">{it.quantity ?? '—'}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={costs[it.id]}
                    onChange={(e) => setCosts((prev) => ({ ...prev, [it.id]: e.target.value }))}
                    style={{ width: 90 }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small" style={{ marginTop: 6 }}>
          Total: <b>{aed(total)}</b>
        </p>
      </Field>
      <Field label="Payment terms" hint="Optional">
        <input value={terms} onChange={(e) => setTerms(e.target.value)} />
      </Field>
      <Field label="Delivery time" hint="Optional">
        <input value={delivery} onChange={(e) => setDelivery(e.target.value)} />
      </Field>
      <Field label="Comments" hint="Optional">
        <textarea rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
      </Field>
      <Field
        label="Quote document"
        hint={
          existing?.attachmentId
            ? 'A document is already attached — choosing a new file replaces it.'
            : "Optional — attach the vendor's quote/RFQ document."
        }
      >
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}
