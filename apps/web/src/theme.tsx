import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api } from './api'

export type ThemePref = 'light' | 'dark' | 'system'
const KEY = 'cpm-theme'

/**
 * The company-wide visual "skin" (palette + typeface). Distinct from the
 * light/dark/system preference above — skin is set once for everyone by a
 * Super Admin (see AdminApp → Appearance); light/dark/system stays a
 * personal choice layered on top of whichever skin is active.
 */
export type Skin = 'default' | 'harbor' | 'foundry' | 'meadow'
export const SKIN_INFO: Record<Skin, { label: string; tagline: string }> = {
  default: { label: 'Default', tagline: 'The original Captain PM look.' },
  harbor: { label: 'Harbor Slate', tagline: 'Calm workspace — slate & teal, Libre Franklin.' },
  foundry: { label: 'Foundry', tagline: 'High-octane ops deck — charcoal, amber & cyan.' },
  meadow: { label: 'Meadow', tagline: 'Fresh & organic — sage, clay, Bricolage Grotesque.' },
}
// Re-poll for a Super Admin's skin change every 45s — cheap enough for an
// internal tool, and near-instant without requiring everyone to refresh.
const SKIN_POLL_MS = 45_000

interface ThemeCtx {
  pref: ThemePref
  resolved: 'light' | 'dark'
  setPref: (p: ThemePref) => void
  skin: Skin
  /** Applies immediately for this tab; call after a Super Admin saves a new skin. */
  setSkinLocally: (s: Skin) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useTheme must be used inside <ThemeProvider>')
  return c
}

function readStored(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* private mode / blocked storage */
  }
  return 'system'
}

function systemDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  )
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readStored)
  const [sysDark, setSysDark] = useState(systemDark)
  const [skin, setSkin] = useState<Skin>('default')

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const on = () => setSysDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const resolved: 'light' | 'dark' =
    pref === 'system' ? (sysDark ? 'dark' : 'light') : pref

  useEffect(() => {
    const root = document.documentElement
    if (pref === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', pref)
  }, [pref])

  useEffect(() => {
    const root = document.documentElement
    if (skin === 'default') root.removeAttribute('data-skin')
    else root.setAttribute('data-skin', skin)
  }, [skin])

  useEffect(() => {
    let cancelled = false
    async function fetchSkin() {
      try {
        const r = await api<{ skin: Skin }>('/appearance')
        if (!cancelled) setSkin(r.skin)
      } catch {
        /* keep whatever skin is currently applied — appearance is non-critical */
      }
    }
    void fetchSkin()
    const t = setInterval(fetchSkin, SKIN_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p)
    try {
      localStorage.setItem(KEY, p)
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <Ctx.Provider value={{ pref, resolved, setPref, skin, setSkinLocally: setSkin }}>
      {children}
    </Ctx.Provider>
  )
}

export function ThemeSwitch() {
  const { pref, setPref } = useTheme()
  const opts: { key: ThemePref; icon: string; label: string }[] = [
    { key: 'light', icon: '☀', label: 'Light' },
    { key: 'dark', icon: '☾', label: 'Dark' },
    { key: 'system', icon: '🖥', label: 'System' },
  ]
  return (
    <div className="theme-switch" role="group" aria-label="Theme">
      {opts.map((o) => (
        <button
          key={o.key}
          className={pref === o.key ? 'active' : ''}
          title={o.label}
          aria-pressed={pref === o.key}
          onClick={() => setPref(o.key)}
        >
          {o.icon}
        </button>
      ))}
    </div>
  )
}
