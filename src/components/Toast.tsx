import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cx } from '../lib/utils'

type Tone = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  tone: Tone
  text: string
}

const Ctx = createContext<(text: string, tone?: Tone) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((text: string, tone: Tone = 'success') => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s.slice(-2), { id, tone, text }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4200)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6">
        {items.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? XCircle : Info
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={cx(
                'animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl px-4 py-3 text-sm shadow-lg ring-1',
                t.tone === 'error' ? 'bg-red-50 text-red-900 ring-red-200' : 'bg-ink-900 text-white ring-ink-800',
              )}
            >
              <Icon className={cx('mt-0.5 size-4 shrink-0', t.tone === 'success' && 'text-brand-300')} aria-hidden />
              <span className="flex-1">{t.text}</span>
              <button type="button" className="-m-1 rounded p-1 opacity-70 hover:opacity-100" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} aria-label="Zamknij powiadomienie">
                <X className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  return useContext(Ctx)
}
