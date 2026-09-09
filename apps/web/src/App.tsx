import { useEffect, useState } from 'react'
import './App.css'

type Health = {
  status: string
  db: string
  service: string
  time: string
}

function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/v1/health')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setHealth)
      .catch((e) => setError(String(e)))
  }, [])

  const dbOk = health?.db === 'connected'

  return (
    <div className="shell">
      <h1>OpsHub</h1>
      <p className="sub">Internal Company Operations &amp; Project Management Platform</p>
      <p className="phase">Phase 1.0.1 — project scaffold</p>

      <div className="card">
        <h2>Backend health check</h2>
        {error && <p className="bad">Could not reach API: {error}</p>}
        {!error && !health && <p className="muted">Checking…</p>}
        {health && (
          <ul>
            <li>API status: <b className={health.status === 'ok' ? 'ok' : 'bad'}>{health.status}</b></li>
            <li>Database: <b className={dbOk ? 'ok' : 'bad'}>{health.db}</b></li>
            <li>Service: {health.service}</li>
            <li>Time: {health.time}</li>
          </ul>
        )}
      </div>

      <p className="muted small">
        When both API status and Database show <b>green</b>, Step 1.0.1 is complete.
      </p>
    </div>
  )
}

export default App
