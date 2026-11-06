import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUp, Download, FileWarning, Sparkles } from 'lucide-react'
import { getTemplate } from '../data/templates'
import { DEFAULT_ANSWERS, generateClauses } from '../lib/contractGenerator'
import { downloadContractPdf } from '../lib/pdf'
import { isPartiesClause } from '../lib/documentFormat'
import { nowIso } from '../lib/utils'
import type { Contract, Party } from '../types'
import { Button, ButtonLink, EmptyState } from '../components/ui'
import { ClauseBody, ClauseHeading, DocumentHeader, PartiesColumns, SignatureStrip } from '../components/workspace/DocumentParts'
import { useGenerate } from '../components/GenerateOverlay'
import { useToast } from '../components/Toast'

/** Podgląd pełnego wzoru bez podawania danych + przyklejony pasek „Edytuj z asystentem AI”. */
export default function TemplatePreviewPage() {
  const { templateId } = useParams()
  const t = getTemplate(templateId)
  const toast = useToast()
  const { generate, overlay, busy } = useGenerate()
  const [text, setText] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)

  const doc = useMemo<Contract | null>(() => {
    if (!t) return null
    const party = (id: 'A' | 'B', i: 0 | 1): Party => ({ id, role: t.roles[i], kind: t.defaultKinds[i], name: '', idNumber: '', address: '', email: '', representative: '' })
    const parties: [Party, Party] = [party('A', 0), party('B', 1)]
    const clauses = generateClauses(t, parties, { ...DEFAULT_ANSWERS, penalty: t.fields.includes('penalty') ? '0,1% wynagrodzenia za każdy dzień opóźnienia (maks. 10%)' : DEFAULT_ANSWERS.penalty })
    const at = nowIso()
    return {
      id: `wzor-${t.id}`,
      title: t.name,
      templateId: t.id,
      source: 'template',
      createdAt: at,
      updatedAt: at,
      stage: 'draft',
      ownerPartyId: 'A',
      parties,
      clauses,
      proposals: [],
      comments: [],
      versions: [{ id: 'v1', number: 1, createdAt: at, authorName: 'Prawo.ai', note: 'Wzór', clauses }],
      signatures: [],
      acceptedBy: {},
      privateChats: {},
      activity: [],
    }
  }, [t])

  if (!t || !doc) {
    return (
      <EmptyState icon={<FileWarning className="size-6" />} title="Nie znaleziono wzoru" action={<ButtonLink to="/wzory">Wróć do biblioteki</ButtonLink>}>
        Ten wzór mógł zostać usunięty albo link jest nieprawidłowy.
      </EmptyState>
    )
  }

  const submit = () => void generate(`Chcę utworzyć: ${t.name}.${text.trim() ? ` ${text.trim()}` : ''}`, { templateHint: t.id })

  const pdf = async () => {
    setPdfBusy(true)
    try {
      await downloadContractPdf(doc)
    } catch {
      toast('Nie udało się wygenerować pliku PDF.', 'error')
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="pb-40">
      {overlay}
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link to={`/wzory/${t.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-ink-900">
            <ArrowLeft className="size-4" aria-hidden /> {t.name}
          </Link>
          <Button variant="secondary" size="sm" onClick={pdf} loading={pdfBusy} icon={<Download className="size-4" />}>
            Pobierz wzór PDF
          </Button>
        </div>

        <article className="overflow-hidden rounded-2xl bg-paper shadow-[0_30px_80px_-40px_rgba(7,27,33,0.45)] ring-1 ring-slate-200" aria-label={`Wzór: ${t.name}`}>
          <DocumentHeader c={doc} eyebrow="Wzór umowy" />
          <p className="border-b border-slate-200/70 bg-amber-50/60 px-5 py-2.5 text-center text-xs text-amber-900 sm:px-10">
            Wzór przykładowy. Miejsca w nawiasach kwadratowych i puste dane stron uzupełni asystent na podstawie Twoich informacji.
          </p>
          <div className="divide-y divide-slate-200/60">
            {doc.clauses.map((cl, i) => (
              <section key={cl.id} className="px-5 py-5 sm:px-10">
                <h3>
                  <ClauseHeading index={i} title={cl.title} />
                </h3>
                {isPartiesClause(doc, i) ? (
                  <div className="mt-4">
                    <PartiesColumns parties={doc.parties} />
                  </div>
                ) : (
                  <ClauseBody text={cl.text} className="mt-3" />
                )}
              </section>
            ))}
          </div>
          <SignatureStrip c={doc} />
        </article>
      </div>

      {/* Przyklejony pasek: Edytuj z asystentem AI */}
      <div className="no-print fixed inset-x-0 bottom-16 z-30 px-3 pb-3 md:bottom-0 md:px-6 md:pb-5">
        <form
          className="mx-auto max-w-3xl rounded-3xl bg-ink-900 p-2 text-white shadow-[0_20px_60px_-15px_rgba(7,27,33,0.6)] ring-1 ring-white/10"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="flex items-center gap-2 px-3 pt-1.5">
            <Sparkles className="size-4 text-brand-300" aria-hidden />
            <label htmlFor="preview-ai" className="text-sm font-semibold">
              Edytuj z asystentem AI
            </label>
            <span className="hidden text-xs text-white/60 sm:inline">· gotowa umowa w ok. 30 sekund</span>
          </div>
          <div className="mt-1.5 flex items-end gap-2 rounded-2xl bg-white p-1.5">
            <textarea
              id="preview-ai"
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder="Np. wklej dane Twoje i drugiej strony, kwotę, terminy i to, na czym Ci zależy"
              className="max-h-40 min-h-12 flex-1 resize-none border-0 bg-transparent px-2.5 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <button type="submit" disabled={busy} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
              <span className="hidden sm:inline">Generuj umowę</span>
              <ArrowUp className="size-4 sm:hidden" aria-hidden />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
