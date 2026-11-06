import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AtSign } from 'lucide-react'
import { mentionSubtitle, type Mention } from '../lib/contractAssistant'
import { cx } from '../lib/utils'

/** Tekst z wyróżnionymi @wzmiankami – warstwa pod przezroczystym polem tekstowym. */
function MentionBackdrop({ text, labels }: { text: string; labels: string[] }) {
  const sorted = [...labels].sort((a, b) => b.length - a.length)
  if (!sorted.length) return <>{text}</>
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(@(?:${sorted.map(esc).join('|')}))`, 'g')
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-md bg-brand-100 text-transparent ring-1 ring-brand-300">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

/**
 * Pole tekstowe z podpowiadaniem osób po „@” (dane zapisane w koncie i umowach).
 * `boxClassName` – wypełnienie i stopień pisma wspólne dla pola i podświetleń.
 */
export const MentionTextarea = forwardRef<
  HTMLTextAreaElement,
  {
    id: string
    value: string
    onChange: (v: string) => void
    onSubmit: () => void
    contacts: Mention[]
    placeholder?: string
    rows?: number
    className?: string
    boxClassName: string
    inputClassName?: string
    /** Gdzie pokazać listę podpowiedzi. */
    listPlacement?: 'above' | 'below'
  }
>(function MentionTextarea({ id, value, onChange, onSubmit, contacts, placeholder, rows = 2, className, boxClassName, inputClassName, listPlacement = 'below' }, ref) {
  const [query, setQuery] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => inputRef.current as HTMLTextAreaElement, [])

  const matches = useMemo(() => {
    if (query === null) return []
    const q = query.toLowerCase().trim()
    return contacts.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 6)
  }, [query, contacts])

  const update = (v: string, caret: number) => {
    const m = v.slice(0, caret).match(/(?:^|\s)@([\p{L}\d .-]{0,30})$/u)
    setQuery(m ? m[1] : null)
    setIdx(0)
  }

  const pick = (c: Mention) => {
    const el = inputRef.current
    const caret = el?.selectionStart ?? value.length
    const before = value.slice(0, caret).replace(/@([\p{L}\d .-]{0,30})$/u, `@${c.label} `)
    const next = before + value.slice(caret)
    onChange(next)
    setQuery(null)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(before.length, before.length)
    })
  }

  return (
    <div className={cx('relative', className)}>
      {matches.length > 0 && (
        <ul role="listbox" aria-label="Osoby z Twojego konta" className={cx('absolute left-0 right-0 z-30 overflow-hidden rounded-xl bg-white py-1 text-left shadow-xl ring-1 ring-slate-200', listPlacement === 'above' ? 'bottom-full mb-2' : 'top-full mt-1')}>
          {matches.map((c, i) => (
            <li key={c.label} role="option" aria-selected={i === idx}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(c)
                }}
                className={cx('flex w-full items-start gap-2 px-3 py-2 text-left text-sm', i === idx ? 'bg-brand-50' : 'hover:bg-slate-50')}
              >
                <AtSign className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink-900">{c.label}</span>
                  <span className="block truncate text-xs text-slate-500">{mentionSubtitle(c)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div ref={backdropRef} aria-hidden className={cx('pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words border border-transparent text-transparent', boxClassName)}>
        <MentionBackdrop text={value} labels={contacts.map((c) => c.label)} />
        {'​'}
      </div>
      <textarea
        id={id}
        ref={inputRef}
        rows={rows}
        value={value}
        onScroll={(e) => {
          if (backdropRef.current) backdropRef.current.scrollTop = e.currentTarget.scrollTop
        }}
        onChange={(e) => {
          onChange(e.target.value)
          update(e.target.value, e.target.selectionStart ?? e.target.value.length)
        }}
        onKeyDown={(e) => {
          if (matches.length) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIdx((i) => (i + 1) % matches.length)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIdx((i) => (i - 1 + matches.length) % matches.length)
              return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              pick(matches[idx])
              return
            }
            if (e.key === 'Escape') {
              setQuery(null)
              return
            }
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSubmit()
          }
        }}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
        placeholder={placeholder}
        aria-autocomplete="list"
        className={cx('relative block w-full resize-none border bg-transparent', boxClassName, inputClassName)}
      />
    </div>
  )
})
