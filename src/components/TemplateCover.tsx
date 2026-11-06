import { ArrowLeftRight, BadgeCheck, FileText } from 'lucide-react'
import type { TemplateDefinition } from '../data/templates'
import { getCategory } from '../data/templates'
import { cx } from '../lib/utils'
import { Wordmark } from './BrandSymbol'

/**
 * Okładka wzoru w stylu „3D” – dokument w perspektywie z grzbietem kartek.
 * size="lg" na stronie wzoru, size="sm" na kartach w bibliotece.
 */
export function TemplateCover({ t, size = 'lg', className }: { t: TemplateDefinition; size?: 'lg' | 'sm'; className?: string }) {
  const lg = size === 'lg'
  const approved = t.status === 'zatwierdzony' && t.review
  return (
    <div className={cx('[perspective:1800px]', className)} aria-hidden>
      <div
        className={cx(
          'relative mx-auto transition-transform duration-500 [transform-style:preserve-3d]',
          lg ? 'aspect-[3/4] w-full max-w-[360px] [transform:rotateY(-16deg)_rotateX(5deg)] hover:[transform:rotateY(-8deg)_rotateX(3deg)]' : 'aspect-[3/4] w-full max-w-[170px] [transform:rotateY(-14deg)_rotateX(4deg)] group-hover:[transform:rotateY(-6deg)_rotateX(2deg)]',
        )}
      >
        {/* kartki pod okładką */}
        {[3, 2, 1].map((i) => (
          <div key={i} className="absolute inset-0 rounded-r-lg rounded-l-sm border border-slate-200 bg-white" style={{ transform: `translate3d(${i * (lg ? 4 : 2.5)}px, ${i * (lg ? 3 : 2)}px, ${-i * 6}px)` }} />
        ))}
        {/* cień */}
        <div className={cx('absolute -bottom-6 left-6 right-0 h-10 rounded-full bg-ink-950/30 blur-2xl', !lg && 'hidden')} />
        {/* okładka */}
        <div className={cx('absolute inset-0 overflow-hidden rounded-r-lg rounded-l-sm bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 text-white shadow-[0_30px_60px_-20px_rgba(7,27,33,0.55)]', lg ? 'p-6' : 'p-3')}>
          {/* grzbiet */}
          <div className={cx('absolute inset-y-0 left-0 bg-gradient-to-r from-black/35 to-transparent', lg ? 'w-4' : 'w-2')} />
          {/* poświata i wzór */}
          <div className="absolute -right-16 -top-16 size-56 rounded-full bg-brand-500/25 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(0deg,#fff_0,#fff_1px,transparent_1px,transparent_22px)]" />

          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between gap-2">
              <Wordmark light className={lg ? 'text-sm' : 'text-[10px]'} />
              {lg && <span className="rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/85">Wzór umowy</span>}
            </div>

            <div className={cx(lg ? 'mt-8' : 'mt-4')}>
              <span className={cx('inline-grid place-items-center rounded-lg bg-white/90 text-ink-800', lg ? 'size-9' : 'size-6')}>
                <FileText className={lg ? 'size-4' : 'size-3'} />
              </span>
              <p className={cx('mt-2 font-semibold uppercase tracking-[0.22em] text-brand-200', lg ? 'text-[10px]' : 'text-[7px]')}>{getCategory(t.category).short}</p>
            </div>

            <p className={cx('mt-2 font-serif font-semibold leading-[1.08]', lg ? 'text-[30px]' : 'text-[15px]')}>{t.name}</p>
            <div className={cx('mt-3 h-px bg-brand-300/70', lg ? 'w-14' : 'w-8')} />

            {lg && <p className="mt-4 font-serif text-[15px] italic leading-snug text-white/85">„{t.description}”</p>}

            <div className={cx('mt-auto flex items-center gap-1.5 text-white/85', lg ? 'text-[13px]' : 'text-[8px]')}>
              <span className="truncate">{t.roles[0]}</span>
              <ArrowLeftRight className={cx('shrink-0 text-brand-300', lg ? 'size-3.5' : 'size-2.5')} />
              <span className="truncate">{t.roles[1]}</span>
            </div>
            <div className={cx('mt-2 flex items-center gap-1.5 border-t border-white/15 pt-2 text-white/70', lg ? 'text-[11px]' : 'text-[7px]')}>
              {approved ? (
                <>
                  <BadgeCheck className={cx('shrink-0 text-brand-300', lg ? 'size-3.5' : 'size-2.5')} /> Sprawdzony przez prawników {t.review!.reviewedBy}
                </>
              ) : (
                'Wzór przykładowy · do weryfikacji'
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
