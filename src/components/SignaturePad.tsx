import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export interface SignaturePadHandle {
  clear: () => void
  isEmpty: () => boolean
  toDataURL: () => string | null
}

/**
 * Pole podpisu na canvasie. Obsługuje mysz, dotyk i rysik (Pointer Events),
 * skaluje się do gęstości pikseli ekranu i wygładza linię krzywymi.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (empty: boolean) => void; label: string; disabled?: boolean }>(function SignaturePad({ onChange, label, disabled }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const points = useRef<{ x: number; y: number; t: number }[]>([])
  const strokes = useRef(0)
  const [empty, setEmpty] = useState(true)

  const setup = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    // Zachowaj istniejący rysunek przy zmianie rozmiaru
    const prev = strokes.current > 0 ? canvas.toDataURL() : null
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0b2a33'
    if (prev) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height)
      img.src = prev
    }
  }, [])

  useEffect(() => {
    setup()
    const ro = new ResizeObserver(() => setup())
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [setup])

  const pos = (e: ReactPointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: performance.now() }
  }

  const markDirty = () => {
    strokes.current += 1
    if (empty) {
      setEmpty(false)
      onChange?.(false)
    }
  }

  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    e.preventDefault()
    canvasRef.current!.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = pos(e)
    points.current = [p]
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.beginPath()
    ctx.fillStyle = '#0b2a33'
    ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2)
    ctx.fill()
    markDirty()
  }

  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const events = (e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]) as PointerEvent[]
    for (const ev of events) {
      const rect = canvasRef.current!.getBoundingClientRect()
      const p = { x: ev.clientX - rect.left, y: ev.clientY - rect.top, t: performance.now() }
      const pts = points.current
      pts.push(p)
      if (pts.length < 3) continue
      const [a, b, c] = pts.slice(-3)
      const dist = Math.hypot(c.x - b.x, c.y - b.y)
      const pressure = ev.pressure && ev.pointerType === 'pen' ? ev.pressure : 0.5
      ctx.lineWidth = Math.max(1.4, Math.min(3.4, 3.2 - dist * 0.08)) * (0.6 + pressure * 0.8)
      ctx.beginPath()
      ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2)
      ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2)
      ctx.stroke()
    }
  }

  const onUp = () => {
    drawing.current = false
    points.current = []
  }

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
      strokes.current = 0
      setEmpty(true)
      onChange?.(true)
    },
    isEmpty: () => strokes.current === 0,
    toDataURL: () => {
      const canvas = canvasRef.current
      if (!canvas || strokes.current === 0) return null
      return canvas.toDataURL('image/png')
    },
  }))

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
        className="block h-44 w-full cursor-crosshair touch-none rounded-xl bg-white ring-1 ring-slate-300 sm:h-48"
      />
      <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-slate-300" aria-hidden />
      {empty && <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-slate-400">Podpisz się palcem lub myszką</p>}
    </div>
  )
})

/** Render podpisu wpisanego z klawiatury (alternatywa dostępnościowa). */
export async function typedSignatureDataUrl(name: string): Promise<string> {
  try {
    await document.fonts.load('600 48px Caveat')
  } catch {
    /* fallback */
  }
  const canvas = document.createElement('canvas')
  const w = 600
  const h = 180
  const dpr = 2
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  let size = 64
  ctx.font = `600 ${size}px Caveat, "Segoe Script", cursive`
  while (ctx.measureText(name).width > w - 40 && size > 24) {
    size -= 4
    ctx.font = `600 ${size}px Caveat, "Segoe Script", cursive`
  }
  ctx.fillStyle = '#0b2a33'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, 20, h / 2)
  return canvas.toDataURL('image/png')
}
