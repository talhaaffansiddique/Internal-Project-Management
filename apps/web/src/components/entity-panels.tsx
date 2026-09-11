import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { ErrorText } from '../ui'
import { celebrateFrom } from '../celebrate'
import type { UserLookup } from '../types'

/* ------------------------------------------------------------------ */
/*  Chatter — comments + audit events, one stream                      */
/* ------------------------------------------------------------------ */

interface ChatterItem {
  kind: 'comment' | 'event'
  id: string
  at: string
  author?: { fullName: string }
  actor?: { fullName: string } | null
  body?: string
  editedAt?: string | null
  summary?: string
}

export function Chatter({
  entityType,
  entityId,
}: {
  entityType: string
  entityId: string
}) {
  const [items, setItems] = useState<ChatterItem[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setItems(await api<ChatterItem[]>(`/${entityType}/${entityId}/chatter`))
  }
  useEffect(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId])

  async function post() {
    if (!body.trim()) return
    setBusy(true)
    try {
      await api(`/${entityType}/${entityId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      setBody('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="compose">
        <textarea
          placeholder="Write a comment…"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          className="btn primary"
          onClick={post}
          disabled={busy || !body.trim()}
        >
          Post
        </button>
      </div>
      {loading ? (
        <p className="muted small">Loading…</p>
      ) : items.length === 0 ? (
        <p className="muted small">No activity yet.</p>
      ) : (
        <ul className="feed">
          {items.map((it) => (
            <li key={it.id} className={`feed-item ${it.kind}`}>
              {it.kind === 'comment' ? (
                <>
                  <div className="feed-meta">
                    <b>{it.author?.fullName}</b> ·{' '}
                    {new Date(it.at).toLocaleString()}
                    {it.editedAt ? ' · edited' : ''}
                  </div>
                  <div className="feed-body">{it.body}</div>
                </>
              ) : (
                <div className="feed-event">
                  <b>{it.actor?.fullName ?? 'System'}</b> {it.summary}
                  <span className="muted small">
                    {' '}
                    · {new Date(it.at).toLocaleString()}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Activities on a record                                             */
/* ------------------------------------------------------------------ */

interface EntityActivity {
  id: string
  title: string
  status: 'OPEN' | 'DONE' | 'CANCELLED'
  dueAt: string
  assignedTo: { id: string; fullName: string }
}

export function EntityActivities({
  entityType,
  entityId,
}: {
  entityType: string
  entityId: string
}) {
  const { user } = useAuth()
  const [rows, setRows] = useState<EntityActivity[]>([])
  const [people, setPeople] = useState<UserLookup[]>([])
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [assignedToId, setAssignedToId] = useState(user!.id)
  const [dueAt, setDueAt] = useState('')

  async function load() {
    setRows(
      await api<EntityActivity[]>(
        `/activities?entityType=${entityType}&entityId=${entityId}`,
      ),
    )
  }
  useEffect(() => {
    void load()
    void api<UserLookup[]>('/users/lookup').then(setPeople)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId])

  async function add() {
    await api('/activities', {
      method: 'POST',
      body: JSON.stringify({
        title,
        assignedToId,
        dueAt: new Date(dueAt).toISOString(),
        entityType,
        entityId,
      }),
    })
    setTitle('')
    setDueAt('')
    setAdding(false)
    await load()
  }

  async function complete(id: string, e: MouseEvent<HTMLButtonElement>) {
    const li = e.currentTarget.closest('li')
    celebrateFrom(e.currentTarget)
    li?.classList.add('celebrating')
    await api(`/activities/${id}/complete`, { method: 'POST' })
    await load()
  }

  return (
    <div>
      {rows.length === 0 && <p className="muted small">No activities.</p>}
      <ul className="mini-list">
        {rows.map((a) => (
          <li key={a.id}>
            <span>
              <b>{a.title}</b>
              <span className="muted small">
                {' '}
                · {a.assignedTo.fullName} · due{' '}
                {new Date(a.dueAt).toLocaleDateString()}
              </span>
            </span>
            {a.status === 'OPEN' ? (
              <button className="btn tiny" onClick={(e) => complete(a.id, e)}>
                Done
              </button>
            ) : (
              <span className="badge ok">done</span>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="inline-form">
          <input
            placeholder="What needs doing?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
                {p.id === user!.id ? ' (me)' : ''}
              </option>
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
            onClick={add}
          >
            Add
          </button>
          <button className="btn" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn" onClick={() => setAdding(true)}>
          + Add activity
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Attachments on a record                                            */
/* ------------------------------------------------------------------ */

interface EntityAttachment {
  id: string
  originalFilename: string
  sizeBytes: number
  mimeType: string
  createdAt: string
  uploadedBy: { fullName: string }
}

export function EntityAttachments({
  entityType,
  entityId,
}: {
  entityType: string
  entityId: string
}) {
  const [rows, setRows] = useState<EntityAttachment[]>([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dragDepth = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setRows(
      await api<EntityAttachment[]>(`/${entityType}/${entityId}/attachments`),
    )
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId])

  async function uploadOne(file: File) {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/v1/attachments', {
      method: 'POST',
      body: fd,
      credentials: 'include',
    })
    if (!res.ok) throw new Error(`Could not upload "${file.name}"`)
    const created = (await res.json()) as { id: string }
    await api(`/${entityType}/${entityId}/attachments`, {
      method: 'POST',
      body: JSON.stringify({ attachmentId: created.id }),
    })
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0) return
    setBusy(true)
    setError(null)
    try {
      for (const file of list) {
        await uploadOne(file)
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }
  function onDragOver(e: DragEvent) {
    e.preventDefault()
  }
  function onDragLeave(e: DragEvent) {
    e.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }
  function onDrop(e: DragEvent) {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files)
  }

  return (
    <div>
      {rows.length > 0 && (
        <ul className="mini-list">
          {rows.map((a) => (
            <li key={a.id}>
              <a href={`/api/v1/attachments/${a.id}/download`}>
                {a.originalFilename}
              </a>
              <span className="muted small">
                {(a.sizeBytes / 1024).toFixed(0)} KB · {a.uploadedBy.fullName}
              </span>
            </li>
          ))}
        </ul>
      )}

      <label
        className={`dropzone ${dragging ? 'dragging' : ''} ${busy ? 'busy' : ''}`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={busy}
          onChange={(e) => {
            if (e.target.files?.length) void uploadFiles(e.target.files)
          }}
        />
        <span className="dropzone-icon">📎</span>
        <span>
          {busy
            ? 'Uploading…'
            : dragging
              ? 'Drop to upload'
              : 'Drag files here, or click to choose'}
        </span>
      </label>
      <ErrorText>{error}</ErrorText>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Audit history                                                      */
/* ------------------------------------------------------------------ */

interface AuditRow {
  id: string
  action: string
  summary: string
  createdAt: string
  actor: { fullName: string } | null
}

export function EntityAudit({
  entityType,
  entityId,
}: {
  entityType: string
  entityId: string
}) {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    api<AuditRow[]>(`/${entityType}/${entityId}/audit`)
      .then(setRows)
      .finally(() => setLoading(false))
  }, [entityType, entityId])

  if (loading) return <p className="muted small">Loading…</p>
  if (rows.length === 0) return <p className="muted small">No history.</p>
  return (
    <ul className="feed">
      {rows.map((r) => (
        <li key={r.id} className="feed-item event">
          <div className="feed-event">
            <b>{r.actor?.fullName ?? 'System'}</b> {r.summary}
            <span className="muted small">
              {' '}
              · {new Date(r.createdAt).toLocaleString()}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
