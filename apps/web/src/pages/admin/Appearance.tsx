import { useState } from 'react'
import { api } from '../../api'
import { ErrorText } from '../../ui'
import { useTheme, SKIN_INFO, type Skin } from '../../theme'

/** Small live palette chip so admins can tell skins apart before switching. */
const SWATCH: Record<Skin, string[]> = {
  default: ['#2563eb', '#7c3aed', '#f4f6f9', '#0f172a'],
  harbor: ['#2F7A73', '#3C7FD1', '#E9EDEE', '#17262A'],
  foundry: ['#F2A93B', '#52C7D1', '#171B20', '#1E242B'],
  meadow: ['#75895A', '#C97B4A', '#EEF0E2', '#25301F'],
}

export default function Appearance() {
  const { skin, setSkinLocally } = useTheme()
  const [saving, setSaving] = useState<Skin | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function apply(next: Skin) {
    if (next === skin || saving) return
    setSaving(next)
    setError(null)
    try {
      await api('/appearance', { method: 'PATCH', body: JSON.stringify({ skin: next }) })
      setSkinLocally(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the theme')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Appearance</h1>
          <p className="muted">
            Sets the visual theme for every employee, company-wide. Only a Super Admin can
            change it — everyone else's screen updates automatically, no re-login needed.
          </p>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="skin-grid">
        {(Object.keys(SKIN_INFO) as Skin[]).map((key) => {
          const info = SKIN_INFO[key]
          const active = skin === key
          return (
            <button
              key={key}
              className={`skin-card ${active ? 'active' : ''}`}
              onClick={() => apply(key)}
              disabled={saving !== null}
            >
              <div className="skin-swatch">
                {SWATCH[key].map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </div>
              <div className="skin-name">{info.label}</div>
              <p className="skin-tagline">{info.tagline}</p>
              <div className="skin-status">
                {active ? (
                  <span className="badge ok">Active for everyone</span>
                ) : saving === key ? (
                  <span className="muted small">Applying…</span>
                ) : (
                  <span className="linklike">Use this theme</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
