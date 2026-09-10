import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
const KEY = 'cpm-theme'

interface ThemeCtx {
  pref: ThemePref
  resolved: 'light' | 'dark'
  setPref: (p: ThemePref) => void
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

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p)
    try {
      localStorage.setItem(KEY, p)
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <Ctx.Provider value={{ pref, resolved, setPref }}>{children}</Ctx.Provider>
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
