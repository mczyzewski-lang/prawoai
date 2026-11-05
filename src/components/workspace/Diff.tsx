import { diffWords } from '../../lib/utils'

/** Podgląd zmian: usunięte (przekreślone) i dodane (podkreślone) fragmenty. */
export function Diff({ from, to, className }: { from: string; to: string; className?: string }) {
  const parts = diffWords(from, to)
  return (
    <p className={`whitespace-pre-wrap font-serif text-[14px] leading-relaxed text-slate-800 ${className ?? ''}`}>
      {parts.map((p, i) =>
        p.type === 'same' ? (
          <span key={i}>{p.text}</span>
        ) : p.type === 'add' ? (
          <ins key={i} className="rounded-sm bg-emerald-100 text-emerald-900 no-underline decoration-emerald-500 [text-decoration-line:underline]">
            <span className="sr-only">[dodano: </span>
            {p.text}
            <span className="sr-only">]</span>
          </ins>
        ) : (
          <del key={i} className="rounded-sm bg-red-50 text-red-800 decoration-red-400">
            <span className="sr-only">[usunięto: </span>
            {p.text}
            <span className="sr-only">]</span>
          </del>
        ),
      )}
    </p>
  )
}
