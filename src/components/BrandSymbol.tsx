import { BRAND_COLORS as C, BRAND_PATHS as P } from '../lib/brand'

/** Symbol Prawo.ai – kartka umowy z iskrą AI. `light` = na ciemnym tle. */
export function BrandSymbol({ className, light }: { className?: string; light?: boolean }) {
  const bg = light ? C.paper : C.ink
  const page = light ? C.ink : C.paper
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill={bg} />
      <path d={P.page} fill={page} />
      <path d={P.fold} fill={C.tealLight} />
      <path d={P.line1} fill={light ? C.paper : C.ink} fillOpacity={0.35} />
      <path d={P.line2} fill={light ? C.paper : C.ink} fillOpacity={0.35} />
      <path d={P.spark} fill={C.teal} stroke={bg} strokeWidth={2.2} strokeLinejoin="round" paintOrder="stroke" />
    </svg>
  )
}
