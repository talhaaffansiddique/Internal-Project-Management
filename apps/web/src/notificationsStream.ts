// One shared SSE connection for the whole app: the server pushes a bare
// "changed" event whenever the current user's notifications change, so
// components can silently refetch instead of polling. No payload on the
// wire — subscribers just re-fetch via the normal REST endpoints.

type Listener = () => void

let es: EventSource | null = null
const listeners = new Set<Listener>()

function ensureConnected() {
  if (es) return
  es = new EventSource('/api/v1/notifications/stream', { withCredentials: true })
  es.addEventListener('changed', () => {
    listeners.forEach((fn) => fn())
  })
}

function teardown() {
  es?.close()
  es = null
}

export function subscribeNotificationsChanged(fn: Listener): () => void {
  listeners.add(fn)
  ensureConnected()
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0) teardown()
  }
}
