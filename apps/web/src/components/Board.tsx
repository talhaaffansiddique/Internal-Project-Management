import { useState, type ReactNode } from 'react'

export interface BoardColumn {
  key: string
  label: string
}

export interface BoardItem {
  id: string
  columnKey: string
  node: ReactNode
}

export function Board({
  columns,
  items,
  onMove,
  onOpen,
}: {
  columns: BoardColumn[]
  items: BoardItem[]
  onMove?: (id: string, toColumnKey: string) => void
  onOpen?: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggle(key: string) {
    setCollapsed((cur) => {
      const next = new Set(cur)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div className="board">
      {columns.map((col, ci) => {
        const colItems = items.filter((i) => i.columnKey === col.key)
        const isCollapsed = collapsed.has(col.key)
        return (
          <div
            key={col.key}
            className={`board-col ${isCollapsed ? 'collapsed' : ''}`}
          >
            <div className="board-col-head">
              <button
                className="collapse-btn"
                title={isCollapsed ? 'Expand' : 'Collapse'}
                onClick={() => toggle(col.key)}
              >
                {isCollapsed ? '»' : '«'}
              </button>
              <span>{col.label}</span>
              <span className="count">{colItems.length}</span>
            </div>
            <div className="board-col-body">
              {colItems.length === 0 && (
                <p className="muted small" style={{ padding: '4px 2px' }}>
                  —
                </p>
              )}
              {colItems.map((it) => (
                <div
                  key={it.id}
                  className="kard"
                  onClick={() => onOpen?.(it.id)}
                >
                  {it.node}
                  {onMove && (
                    <div
                      className="kard-move"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        disabled={ci === 0}
                        title="Move left"
                        onClick={() => onMove(it.id, columns[ci - 1].key)}
                      >
                        ◀
                      </button>
                      <button
                        disabled={ci === columns.length - 1}
                        title="Move right"
                        onClick={() => onMove(it.id, columns[ci + 1].key)}
                      >
                        ▶
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
