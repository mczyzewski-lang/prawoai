import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react'
import { cx, STATUS_META, type DisplayStatus } from '../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type Size = 'sm' | 'md' | 'lg'

const variantCls: Record<Variant, string> = {
  primary: 'bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950 shadow-sm',
  accent: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm',
  secondary: 'bg-white text-ink-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:ring-slate-400',
  ghost: 'text-ink-800 hover:bg-ink-900/5',
  danger: 'bg-white text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50',
}
const sizeCls: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cx(
    'inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 select-none whitespace-nowrap',
    variantCls[variant],
    sizeCls[size],
    extra,
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

export function ButtonLink({ variant = 'primary', size = 'md', icon, className, children, ...rest }: LinkProps & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  )
}

export function StatusBadge({ status, className }: { status: DisplayStatus; className?: string }) {
  const m = STATUS_META[status]
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', m.tone, className)}>
      <span className={cx('size-1.5 rounded-full', m.dot)} aria-hidden />
      {m.label}
    </span>
  )
}

export function Badge({ children, tone = 'slate', className }: { children: ReactNode; tone?: 'slate' | 'brand' | 'amber' | 'red' | 'violet' | 'sky'; className?: string }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    brand: 'bg-brand-50 text-brand-800',
    amber: 'bg-amber-50 text-amber-900',
    red: 'bg-red-50 text-red-800',
    violet: 'bg-violet-50 text-violet-800',
    sky: 'bg-sky-50 text-sky-800',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>
}

export function Card({ children, className, as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'li' }) {
  return <As className={cx('rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]', className)}>{children}</As>
}

export function Spinner({ label = 'Ładowanie…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cx('flex items-center gap-2 text-sm text-slate-600', className)}>
      <Loader2 className="size-4 animate-spin text-brand-600" aria-hidden />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ icon, title, children, action, className }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center', className)}>
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700" aria-hidden>
        {icon}
      </div>
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-slate-600">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Alert({ tone = 'info', title, children, onClose, className }: { tone?: 'info' | 'success' | 'warning' | 'error'; title?: string; children?: ReactNode; onClose?: () => void; className?: string }) {
  const map = {
    info: { cls: 'bg-sky-50 text-sky-900 ring-sky-200', Icon: Info },
    success: { cls: 'bg-emerald-50 text-emerald-900 ring-emerald-200', Icon: CheckCircle2 },
    warning: { cls: 'bg-amber-50 text-amber-950 ring-amber-200', Icon: AlertTriangle },
    error: { cls: 'bg-red-50 text-red-900 ring-red-200', Icon: XCircle },
  }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-xl p-3.5 text-sm ring-1 ring-inset', map.cls, className)}>
      <map.Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && 'mt-0.5', 'leading-relaxed')}>{children}</div>}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="-m-1 rounded-md p-1 opacity-70 hover:opacity-100" aria-label="Zamknij komunikat">
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

const fieldBase =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50'

interface FieldWrapProps {
  label: string
  hint?: string
  error?: string
  optional?: boolean
  className?: string
}

function FieldWrap({ id, label, hint, error, optional, className, children }: FieldWrapProps & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-slate-800">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-slate-500">opcjonalnie</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextField({ label, hint, error, optional, className, ...rest }: FieldWrapProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <input id={id} className={cx(fieldBase, 'h-11', error && 'border-red-400')} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...rest} />
    </FieldWrap>
  )
}

export function TextArea({ label, hint, error, optional, className, ...rest }: FieldWrapProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <textarea id={id} className={cx(fieldBase, 'py-2.5 leading-relaxed', error && 'border-red-400')} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...rest} />
    </FieldWrap>
  )
}

export function SelectField({ label, hint, error, optional, className, options, ...rest }: FieldWrapProps & SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  const id = useId()
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <select id={id} className={cx(fieldBase, 'h-11 pr-8')} aria-describedby={hint ? `${id}-hint` : undefined} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  )
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter((x) => !x.hasAttribute('disabled'))
    const first = focusables().find((x) => x.dataset.autofocus !== undefined) ?? focusables()[1] ?? focusables()[0]
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const f = focusables()
        if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault()
          f[f.length - 1].focus()
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault()
          f[0].focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx('animate-fade-up relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl', size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg')}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 pb-3 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-ink-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="-m-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Zamknij">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="safe-bottom flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, className, label }: { tabs: { id: T; label: string; icon?: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  return (
    <div role="tablist" aria-label={label} className={cx('scrollbar-thin flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1', className)}>
      {tabs.map((t, i) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
              onChange(tabs[next].id)
              refs.current[next]?.focus()
            }}
            className={cx(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition',
              active ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600 hover:text-ink-900',
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className={cx('rounded-full px-1.5 text-xs', active ? 'bg-brand-100 text-brand-800' : 'bg-slate-200 text-slate-700')}>{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-700">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Avatar({ name, tone = 'brand', size = 'md' }: { name: string; tone?: 'brand' | 'violet' | 'slate'; size?: 'sm' | 'md' }) {
  const tones = { brand: 'bg-brand-100 text-brand-800', violet: 'bg-violet-100 text-violet-800', slate: 'bg-slate-200 text-slate-700' }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return (
    <span aria-hidden className={cx('inline-grid shrink-0 place-items-center rounded-full font-semibold', tones[tone], size === 'sm' ? 'size-7 text-[11px]' : 'size-9 text-xs')}>
      {initials || '?'}
    </span>
  )
}
