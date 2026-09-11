import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import type { Project, Task, UserLookup } from '../../types'
import { Modal, Field, ErrorText } from '../../ui'
import {
  Chatter,
  EntityActivities,
  EntityAttachments,
  EntityAudit,
} from '../../components/entity-panels'

const PRJ_STATUS = ['planned', 'in_progress', 'at_risk', 'delayed', 'on_hold', 'completed']
const PRJ_LABEL: Record<string, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  at_risk: 'At Risk',
  delayed: 'Delayed',
  on_hold: 'On Hold',
  completed: 'Completed',
}
const TASK_GROUPS: { key: string; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'in_review', label: 'In Review' },
  { key: 'done', label: 'Done' },
]
const TASK_STATUS = TASK_GROUPS.map((g) => g.key)
const projectNo = (n: number) => `PRJ-${String(n).padStart(4, '0')}`

type Tab = 'tasks' | 'discussion' | 'activity' | 'files' | 'history'
const TAB_LABEL: Record<Tab, string> = {
  tasks: 'Tasks',
  discussion: 'Discussion',
  activity: 'To-dos',
  files: 'Files',
  history: 'Activity',
}

export default function ProjectDetail({
  id,
  onBack,
}: {
  id: string
  onBack: () => void
}) {
  const { user } = useAuth()
  const isAdmin = !!user?.roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN')
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [people, setPeople] = useState<UserLookup[]>([])
  const [tab, setTab] = useState<Tab>('tasks')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const canManage = !!project && (isAdmin || project.owner.id === user!.id)

  async function loadProject() {
    try {
      setProject(await api<Project>(`/projects/${id}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load project')
    }
  }
  async function loadTasks() {
    setTasks(await api<Task[]>(`/projects/${id}/tasks`))
  }
  useEffect(() => {
    void loadProject()
    void loadTasks()
    void api<UserLookup[]>('/users/lookup').then(setPeople)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function changeStatus(statusKey: string) {
    await api(`/projects/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ statusKey }),
    })
    void loadProject()
  }
  async function addTask(parentTaskId?: string, title?: string) {
    const t = (title ?? newTaskTitle).trim()
    if (!t) return
    await api(`/projects/${id}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title: t, parentTaskId }),
    })
    setNewTaskTitle('')
    await Promise.all([loadTasks(), loadProject()])
  }
  async function taskStatus(taskId: string, statusKey: string) {
    await api(`/tasks/${taskId}/status`, {
      method: 'POST',
      body: JSON.stringify({ statusKey }),
    })
    await Promise.all([loadTasks(), loadProject()])
  }
  async function taskAssign(taskId: string, assigneeId: string) {
    await api(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeId: assigneeId || undefined }),
    })
    void loadTasks()
  }
  async function removeMember(memberId: string) {
    await api(`/projects/${id}/members/${memberId}`, { method: 'DELETE' })
    void loadProject()
  }
  async function addMember(userId: string) {
    if (!userId) return
    await api(`/projects/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
    void loadProject()
  }

  if (error) {
    return (
      <div>
        <button className="btn" onClick={onBack}>← Back</button>
        <p className="error-text" style={{ marginTop: 16 }}>{error}</p>
      </div>
    )
  }
  if (!project) return <p className="muted">Loading…</p>

  const memberIds = new Set(project.members.map((m) => m.user.id))

  return (
    <div>
      <button className="btn" onClick={onBack}>← All projects</button>

      <div className="page-head" style={{ marginTop: 14 }}>
        <div>
          <h1>
            <span className="muted">{projectNo(project.number)}</span> {project.title}
          </h1>
          <p className="muted small">
            Owner {project.owner.fullName}
            {project.targetDate &&
              ` · target ${new Date(project.targetDate).toLocaleDateString()}`}
          </p>
        </div>
        {canManage && (
          <button className="btn" onClick={() => setEditing(true)}>Edit</button>
        )}
      </div>

      <div className="status-bar">
        {canManage ? (
          <select
            value={project.statusKey}
            onChange={(e) => changeStatus(e.target.value)}
          >
            {PRJ_STATUS.map((s) => (
              <option key={s} value={s}>{PRJ_LABEL[s] ?? s}</option>
            ))}
          </select>
        ) : (
          <span className="badge warn">{PRJ_LABEL[project.statusKey] ?? project.statusKey}</span>
        )}
        <div className="progress-wrap" title={`${project.progress}% of tasks done`}>
          <div className="progress-bar" style={{ width: `${project.progress}%` }} />
        </div>
        <span className="muted small">{project.progress}%</span>
      </div>

      <div className="detail-grid" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Team</h3>
          <ul className="mini-list">
            {project.members.map((m) => (
              <li key={m.id}>
                <span>
                  {m.user.fullName}
                  {m.user.id === project.owner.id && (
                    <span className="role-chip">owner</span>
                  )}
                </span>
                {canManage && m.user.id !== project.owner.id && (
                  <button className="btn tiny" onClick={() => removeMember(m.user.id)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canManage && (
            <select
              value=""
              onChange={(e) => addMember(e.target.value)}
              style={{ marginTop: 6 }}
            >
              <option value="">+ Add member…</option>
              {people
                .filter((p) => !memberIds.has(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
            </select>
          )}
          {project.description && (
            <>
              <h3 style={{ marginTop: 16 }}>About</h3>
              <p>{project.description}</p>
            </>
          )}
        </div>

        <div className="card">
          <div className="tabs">
            {(['tasks', 'discussion', 'activity', 'files', 'history'] as Tab[]).map(
              (t) => (
                <button
                  key={t}
                  className={`tab ${tab === t ? 'active' : ''}`}
                  onClick={() => setTab(t)}
                >
                  {TAB_LABEL[t]}
                </button>
              ),
            )}
          </div>
          <div className="tab-body">
            {tab === 'tasks' && (
              <div>
                <div className="inline-form" style={{ marginBottom: 12 }}>
                  <input
                    placeholder="New task…"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTask()}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn primary"
                    disabled={!newTaskTitle.trim()}
                    onClick={() => addTask()}
                  >
                    Add
                  </button>
                </div>
                {TASK_GROUPS.map((g) => {
                  const rows = tasks.filter((t) => t.statusKey === g.key)
                  if (rows.length === 0) return null
                  return (
                    <div key={g.key} className="task-group">
                      <div className="task-group-head">
                        {g.label} ({rows.length})
                      </div>
                      {rows.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          people={people}
                          onStatus={taskStatus}
                          onAssign={taskAssign}
                          onAddSubtask={(title) => addTask(t.id, title)}
                        />
                      ))}
                    </div>
                  )
                })}
                {tasks.length === 0 && (
                  <p className="muted small">No tasks yet.</p>
                )}
              </div>
            )}
            {tab === 'discussion' && <Chatter entityType="projects" entityId={id} />}
            {tab === 'activity' && (
              <EntityActivities entityType="projects" entityId={id} />
            )}
            {tab === 'files' && (
              <EntityAttachments entityType="projects" entityId={id} />
            )}
            {tab === 'history' && (
              <EntityAudit entityType="projects" entityId={id} />
            )}
          </div>
        </div>
      </div>

      {editing && (
        <EditProjectModal
          project={project}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            void loadProject()
          }}
        />
      )}
    </div>
  )
}

function TaskRow({
  task,
  people,
  onStatus,
  onAssign,
  onAddSubtask,
}: {
  task: Task
  people: UserLookup[]
  onStatus: (id: string, s: string) => void
  onAssign: (id: string, a: string) => void
  onAddSubtask: (title: string) => void
}) {
  const [addingSub, setAddingSub] = useState(false)
  const [subTitle, setSubTitle] = useState('')
  return (
    <div className="task-row">
      <div className="task-main">
        <span>{task.title}</span>
        <span className="muted small">
          {new Date(task.createdAt).toLocaleDateString()}
        </span>
      </div>
      <select
        value={task.assignee?.id ?? ''}
        onChange={(e) => onAssign(task.id, e.target.value)}
      >
        <option value="">unassigned</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>{p.fullName}</option>
        ))}
      </select>
      <select
        value={task.statusKey}
        onChange={(e) => onStatus(task.id, e.target.value)}
      >
        {TASK_STATUS.map((s) => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </select>
      <button
        className="linklike"
        style={{ fontSize: 11 }}
        onClick={() => setAddingSub((v) => !v)}
      >
        + sub
      </button>
      {(task.subtasks?.length || addingSub) && (
        <div className="subtasks">
          {task.subtasks?.map((s) => (
            <div key={s.id} className="subtask">
              <span>↳ {s.title}</span>
              <span className="muted small">{s.statusKey.replace('_', ' ')}</span>
            </div>
          ))}
          {addingSub && (
            <div className="inline-form">
              <input
                placeholder="Subtask…"
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
              />
              <button
                className="btn tiny primary"
                disabled={!subTitle.trim()}
                onClick={() => {
                  onAddSubtask(subTitle)
                  setSubTitle('')
                  setAddingSub(false)
                }}
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EditProjectModal({
  project,
  onClose,
  onSaved,
}: {
  project: Project
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(project.title)
  const [description, setDescription] = useState(project.description ?? '')
  const [targetDate, setTargetDate] = useState(
    project.targetDate ? project.targetDate.slice(0, 10) : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api(`/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          description: description || undefined,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
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
      title={`Edit ${projectNo(project.number)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={busy || !title.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Description">
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Target date">
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      </Field>
      <ErrorText>{error}</ErrorText>
    </Modal>
  )
}
