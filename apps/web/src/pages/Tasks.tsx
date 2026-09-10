import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Task } from '../types'
import { Board } from '../components/Board'

const GROUPS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'in_review', label: 'In Review' },
  { key: 'done', label: 'Done' },
]
const taskNo = (n: number) => `TSK-${String(n).padStart(4, '0')}`
const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('')

export default function Tasks({
  onOpenProject,
}: {
  onOpenProject: (id: string) => void
}) {
  const [rows, setRows] = useState<Task[]>([])
  const [view, setView] = useState<'mine' | 'all'>('mine')
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      setRows(await api<Task[]>(`/tasks?view=${view}`))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  async function setStatus(id: string, statusKey: string) {
    setRows((cur) => cur.map((t) => (t.id === id ? { ...t, statusKey } : t)))
    await api(`/tasks/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ statusKey }),
    })
    void load()
  }

  function openTasksProject(taskId: string) {
    const t = rows.find((r) => r.id === taskId)
    if (t?.project) onOpenProject(t.project.id)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Tasks</h1>
          <p className="muted">Tasks across all your projects.</p>
        </div>
        <div className="view-toggle">
          <button
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
          >
            List
          </button>
          <button
            className={viewMode === 'board' ? 'active' : ''}
            onClick={() => setViewMode('board')}
          >
            Board
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 12 }}>
        <button
          className={`tab ${view === 'mine' ? 'active' : ''}`}
          onClick={() => setView('mine')}
        >
          My Tasks
        </button>
        <button
          className={`tab ${view === 'all' ? 'active' : ''}`}
          onClick={() => setView('all')}
        >
          All (my projects)
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No tasks.</p>
      ) : viewMode === 'board' ? (
        <Board
          columns={GROUPS}
          onMove={setStatus}
          onOpen={openTasksProject}
          items={rows.map((t) => ({
            id: t.id,
            columnKey: t.statusKey,
            node: (
              <>
                <div className="kard-title">{t.title}</div>
                <div className="kard-meta">
                  {t.project?.title ?? '—'}
                </div>
                <div className="kard-foot">
                  <span className="muted small">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </span>
                  {t.assignee && (
                    <span className="mini-avatar">
                      {initials(t.assignee.fullName)}
                    </span>
                  )}
                </div>
              </>
            ),
          }))}
        />
      ) : (
        GROUPS.map((g) => {
          const items = rows.filter((t) => t.statusKey === g.key)
          if (items.length === 0) return null
          return (
            <div key={g.key} className="panel">
              <h3>
                {g.label} ({items.length})
              </h3>
              <div className="panel-body">
                <table className="grid">
                  <tbody>
                    {items.map((t) => (
                      <tr key={t.id}>
                        <td style={{ width: 90 }}>
                          <b>{taskNo(t.number)}</b>
                        </td>
                        <td>{t.title}</td>
                        <td
                          className="muted small link-cell"
                          onClick={() =>
                            t.project && onOpenProject(t.project.id)
                          }
                        >
                          {t.project?.title ?? '—'}
                        </td>
                        <td className="muted small">
                          {t.assignee?.fullName ?? 'unassigned'}
                        </td>
                        <td className="muted small" style={{ width: 100 }}>
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>
                        <td
                          style={{ width: 150 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={t.statusKey}
                            onChange={(e) => setStatus(t.id, e.target.value)}
                          >
                            {GROUPS.map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
