/**
 * Shared "task completed" particle burst. Reads the live theme tokens and
 * current skin off <html> at call time, so it always matches whatever
 * company skin + light/dark mode is active — no per-skin call sites needed.
 */

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.style.position = 'fixed'
    canvas.style.inset = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '4000'
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    document.body.appendChild(canvas)
    ctx = canvas.getContext('2d')
    window.addEventListener('resize', () => {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    })
  }
  return ctx
}

function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/** Burst particles from (x, y) — pass the completed control's screen position. */
export function celebrate(x: number, y: number) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const c = ensureCanvas()
  if (!c || !canvas) return

  const skin = document.documentElement.getAttribute('data-skin') ?? 'default'
  const colors = [
    token('--primary', '#2563eb'),
    token('--accent', '#7c3aed'),
    token('--ok', '#16a34a'),
    token('--primary-strong', '#1d4ed8'),
  ]
  // Shape language matches each skin's own visual identity from the
  // Appearance gallery: soft dots (default/harbor), angular slivers
  // (foundry), and drifting leaves (meadow).
  const shape: 'dot' | 'sliver' | 'leaf' = skin === 'foundry' ? 'sliver' : skin === 'meadow' ? 'leaf' : 'dot'

  const n = 22
  const parts = Array.from({ length: n }, (_, i) => {
    const a = shape === 'sliver' ? -Math.PI / 2 + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2
    const s = shape === 'sliver' ? 2.4 + Math.random() * 3.4 : 1.8 + Math.random() * 2.8
    return {
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (shape === 'dot' ? 1.4 : 0.6),
      g: shape === 'leaf' ? 0.09 : 0.12,
      r: 2 + Math.random() * 2.4,
      len: 5 + Math.random() * 4,
      ang: Math.random() * Math.PI * 2,
      sway: Math.random() * Math.PI * 2,
      c: colors[i % colors.length],
      life: 1,
    }
  })

  function frame() {
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    let alive = false
    for (const p of parts) {
      if (p.life <= 0) continue
      alive = true
      p.vy += p.g
      p.sway += 0.22
      p.x += p.vx + (shape === 'leaf' ? Math.sin(p.sway) * 0.4 : 0)
      p.y += p.vy
      p.ang += shape === 'sliver' ? 0.3 : 0
      p.life -= shape === 'leaf' ? 0.016 : 0.02
      ctx.globalAlpha = Math.max(p.life, 0)
      ctx.fillStyle = p.c
      if (shape === 'sliver') {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.ang)
        ctx.fillRect(-p.len / 2, -1.5, p.len, 3)
        ctx.restore()
      } else if (shape === 'leaf') {
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, p.r, p.r * 1.4, p.sway, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
    if (alive) requestAnimationFrame(frame)
    else ctx?.clearRect(0, 0, canvas!.width, canvas!.height)
  }
  requestAnimationFrame(frame)
}

/** Convenience: burst from the center of a DOM element (e.g. e.currentTarget). */
export function celebrateFrom(el: Element) {
  const r = el.getBoundingClientRect()
  celebrate(r.left + r.width / 2, r.top + r.height / 2)
}
