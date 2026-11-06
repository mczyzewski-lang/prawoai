import { BRAND_COLORS as C, BRAND_PATHS as P, WORDMARK_PATHS as W } from '../lib/brand'
import { cx } from '../lib/utils'

/** Ikona Prawo.ai – litera P z iskrą AI i linią podpisu. `light` = na ciemnym tle. */
export function BrandSymbol({ className, light }: { className?: string; light?: boolean }) {
  const bg = light ? C.paper : C.ink
  const fg = light ? C.ink : C.paper
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill={bg} />
      <path d={P.letter} fill={fg} fillRule="evenodd" />
      <path d={P.spark} fill={C.teal} />
      <path d={P.swash} fill="none" stroke={C.teal} strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}

/** Napis „Prawo✦ai” z linią podpisu pod „Prawo”. Rozmiar dziedziczy z font-size. */
export function Wordmark({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cx('inline-block whitespace-nowrap pb-[0.18em] font-sans font-bold leading-none tracking-[-0.03em]', className)}>
      <span className="relative inline-block" style={{ color: light ? C.paper : C.ink }}>
        Prawo
        <svg viewBox="0 0 120 16" preserveAspectRatio="none" className="pointer-events-none absolute -left-[3%] top-[0.92em] h-[0.3em] w-[106%]" aria-hidden>
          <path d={W.swash} fill="none" stroke={C.teal} strokeWidth={3} strokeLinecap="round" />
        </svg>
      </span>
      <svg viewBox="0 0 20 20" className="mx-[0.03em] inline-block size-[0.4em] align-baseline" aria-hidden>
        <path d={W.spark} fill={C.teal} />
      </svg>
      <span style={{ color: light ? C.tealLight : C.tealDark }}>ai</span>
    </span>
  )
}
