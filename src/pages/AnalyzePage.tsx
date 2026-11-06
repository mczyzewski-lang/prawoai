import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ClipboardPaste, FileText, FileUp, Loader2, Lock, Sparkles, Trash2, Upload } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Alert, Button, Card, PageHeader, Tabs } from '../components/ui'
import { analyzeContract, parseClauses } from '../lib/analyzer'
import { extractText, ExtractError, MAX_FILE_MB } from '../lib/extract'
import { analyzeWithAi, getAiStatus, AiAnalysisError, type AiStatus } from '../lib/aiAnalysis'
import { SAMPLE_CONTRACT_TEXT } from '../data/sampleTexts'
import type { AnalysisResult, Clause, Contract, PartyId } from '../types'
import { cx, nowIso, sleep, uid, wordCount } from '../lib/utils'

type Mode = 'file' | 'paste'
const stagesFor = (ai: boolean) => ['Odczytywanie dokumentu', 'Dzielenie na zapisy', ai ? 'Ocena zapisów przez model AI (to może potrwać do 2 minut)' : 'Sprawdzanie ryzyk i braków', 'Przygotowanie podsumowania']

export default function AnalyzePage() {
  const { state, upsertContract } = useStore()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('file')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState(-1)
  const [prep, setPrep] = useState<{ clauses: Clause[]; parties: { name: string; role: string }[] } | null>(null)
  const [lastParty, setLastParty] = useState<PartyId | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [ai, setAi] = useState<AiStatus | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [usingAi, setUsingAi] = useState(false)

  useEffect(() => {
    void getAiStatus().then(setAi)
  }, [])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    setReading(true)
    setFileName(file.name)
    try {
      const t = await extractText(file)
      setText(t)
    } catch (e) {
      setText('')
      setFileName(null)
      setError(e instanceof ExtractError ? e.message : 'Nie udało się odczytać pliku.')
    } finally {
      setReading(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void handleFile(f)
  }

  /** Krok 1: podział na zapisy i rozpoznanie stron, potem pytanie o perspektywę. */
  const start = () => {
    setError(null)
    setAiError(null)
    if (wordCount(text) < 30) {
      setError('Tekst jest za krótki, aby go przeanalizować. Wklej całą umowę (co najmniej kilka zapisów).')
      return
    }
    const clauses = parseClauses(text)
    const parties = analyzeContract(text, clauses, '').parties
    setPrep({ clauses, parties })
  }

  /** Krok 2: ocena z perspektywy wybranej strony. */
  const analyzeAs = async (myParty: PartyId | null, forceRules = false) => {
    if (!prep) return
    setAiError(null)
    setLastParty(myParty)
    const withAi = !forceRules && !!ai?.ai
    setUsingAi(withAi)
    const { clauses, parties } = prep
    const idx = myParty === 'B' ? 1 : 0
    const roleOf = (i: number) => parties[i]?.role ?? (i === 0 ? 'Strona pierwsza' : 'Strona druga')
    setStage(0)
    await sleep(300)
    setStage(1)
    await sleep(300)
    setStage(2)
    const source = fileName ?? 'Wklejony tekst'
    let analysis: AnalysisResult
    if (withAi) {
      try {
        analysis = await analyzeWithAi(text, clauses, source, myParty ? { role: roleOf(idx), name: parties[idx]?.name ?? '', otherRole: roleOf(1 - idx) } : undefined)
      } catch (e) {
        setStage(-1)
        setAiError(e instanceof AiAnalysisError ? e.message : 'Nie udało się przeprowadzić analizy AI.')
        return
      }
    } else {
      analysis = analyzeContract(text, clauses, source)
      await sleep(600)
    }
    setStage(3)
    await sleep(300)
    setStage(-1)
    create(myParty ?? 'A', clauses, analysis)
  }

  const create = (myParty: PartyId, clauses: Clause[], analysis: AnalysisResult) => {
    const at = nowIso()
    const p = analysis.parties.length >= 2 ? analysis.parties : prep?.parties ?? []
    const c: Contract = {
      id: uid('k'),
      title: fileName ? fileName.replace(/\.(pdf|docx|txt|md)$/i, '') : analysis.contractType,
      source: fileName ? 'upload' : 'paste',
      createdAt: at,
      updatedAt: at,
      stage: 'draft',
      ownerPartyId: myParty,
      parties: [
        { id: 'A', role: p[0]?.role ?? 'Strona pierwsza', kind: 'firma', name: p[0]?.name ?? 'Strona pierwsza', idNumber: '', address: '', email: '', representative: '' },
        { id: 'B', role: p[1]?.role ?? 'Strona druga', kind: 'firma', name: p[1]?.name ?? 'Strona druga', idNumber: '', address: '', email: '', representative: '' },
      ],
      clauses,
      proposals: [],
      comments: [],
      versions: [{ id: uid('v'), number: 1, createdAt: at, authorName: state.profile.name, note: `Wgrano dokument: ${analysis.sourceName}`, clauses: clauses.map((x) => ({ ...x })) }],
      signatures: [],
      acceptedBy: {},
      analysis,
      privateChats: {},
      activity: [{ id: uid('a'), at, text: `${state.profile.name} dodał(a) dokument do analizy`, partyId: myParty }],
    }
    upsertContract(c)
    navigate(`/umowy/${c.id}?panel=analiza`)
  }

  const busy = stage >= 0

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Analizuj umowę" title="Sprawdź umowę, zanim ją podpiszesz" description="Wskażemy niejasne i ryzykowne zapisy, brakujące postanowienia oraz zaproponujemy alternatywne brzmienie. Ty decydujesz, co zmienić." />

      {prep && !busy ? (
        <Card className="animate-fade-up p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700" aria-hidden>
              <Check className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-ink-900">Którą stroną umowy jesteś?</h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Ocenimy umowę z Twojej perspektywy: co jest dla Ciebie ryzykowne lub niekorzystne – także finansowo i biznesowo – i o co warto negocjować. Dokument ma {prep.clauses.length} zapisów.
              </p>
            </div>
          </div>
          {aiError && (
            <Alert tone="error" className="mt-4" title="Ocena przez model AI nie powiodła się">
              {aiError}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => analyzeAs(lastParty)}>
                  Spróbuj ponownie
                </Button>
                <Button size="sm" variant="secondary" onClick={() => analyzeAs(lastParty, true)}>
                  Użyj analizy podstawowej
                </Button>
              </div>
            </Alert>
          )}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {(['A', 'B'] as PartyId[]).map((id, i) => {
              const p = prep.parties[i]
              return (
                <button key={id} type="button" onClick={() => analyzeAs(id)} className="rounded-2xl p-4 text-left ring-1 ring-slate-200 transition hover:bg-brand-50 hover:ring-brand-400">
                  <span className="block font-semibold text-ink-900">{p?.role ?? (i === 0 ? 'Strona pierwsza' : 'Strona druga')}</span>
                  <span className="mt-0.5 block truncate text-sm text-slate-600">{p?.name ?? 'Nie rozpoznano nazwy'}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setPrep(null)} className="text-sm font-medium text-slate-600 hover:text-ink-900">
              Wróć i zmień dokument
            </button>
            <button type="button" onClick={() => analyzeAs(null)} className="text-sm font-medium text-brand-700 hover:underline">
              Oceń neutralnie
            </button>
          </div>
        </Card>
      ) : busy ? (
        <Card className="p-6" >
          <div role="status" aria-live="polite">
            <h2 className="text-lg font-semibold text-ink-900">Analizujemy dokument…</h2>
            <ol className="mt-4 space-y-3">
              {stagesFor(usingAi).map((s, i) => (
                <li key={s} className="flex items-center gap-3 text-sm">
                  <span className={cx('grid size-6 place-items-center rounded-full', i < stage ? 'bg-brand-600 text-white' : i === stage ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400')}>
                    {i < stage ? <Check className="size-3.5" aria-hidden /> : i === stage ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <span className="size-1.5 rounded-full bg-current" />}
                  </span>
                  <span className={i <= stage ? 'text-ink-900' : 'text-slate-500'}>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      ) : (
        <Card className="p-5 sm:p-6">
          <Tabs<Mode>
            label="Sposób dodania umowy"
            value={mode}
            onChange={setMode}
            tabs={[
              { id: 'file', label: 'Wgraj plik', icon: <FileUp className="size-4" aria-hidden /> },
              { id: 'paste', label: 'Wklej tekst', icon: <ClipboardPaste className="size-4" aria-hidden /> },
            ]}
            className="mb-5 w-fit"
          />

          {mode === 'file' ? (
            fileName && text ? (
              <div className="flex items-center gap-3 rounded-2xl bg-sand-50 p-4 ring-1 ring-slate-200">
                <span className="grid size-10 place-items-center rounded-xl bg-white text-ink-800 ring-1 ring-slate-200" aria-hidden>
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink-900">{fileName}</p>
                  <p className="text-xs text-slate-600">Odczytano ok. {wordCount(text)} słów</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Usuń plik"
                  onClick={() => {
                    setFileName(null)
                    setText('')
                  }}
                  icon={<Trash2 className="size-4" />}
                />
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={cx('flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition', dragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-sand-50/60')}
              >
                {reading ? (
                  <div role="status" className="flex flex-col items-center gap-2 text-sm text-slate-600">
                    <Loader2 className="size-7 animate-spin text-brand-600" aria-hidden /> Odczytujemy plik…
                  </div>
                ) : (
                  <>
                    <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-700 shadow-sm ring-1 ring-slate-200" aria-hidden>
                      <Upload className="size-5" />
                    </span>
                    <p className="mt-3 font-medium text-ink-900">Przeciągnij plik tutaj</p>
                    <p className="mt-0.5 text-sm text-slate-600">PDF, DOCX lub TXT, do {MAX_FILE_MB} MB</p>
                    <Button className="mt-4" variant="primary" onClick={() => inputRef.current?.click()}>
                      Wybierz plik
                    </Button>
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      className="sr-only"
                      aria-label="Wybierz plik umowy"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void handleFile(f)
                        e.target.value = ''
                      }}
                    />
                  </>
                )}
              </div>
            )
          ) : (
            <div>
              <div className="mb-1.5 flex items-end justify-between gap-2">
                <label htmlFor="paste" className="text-sm font-medium text-slate-800">
                  Treść umowy
                </label>
                <button type="button" onClick={() => setText(SAMPLE_CONTRACT_TEXT)} className="text-sm font-medium text-brand-700 hover:underline">
                  Wstaw przykładową umowę
                </button>
              </div>
              <textarea
                id="paste"
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setFileName(null)
                }}
                rows={14}
                placeholder="Wklej tutaj pełną treść umowy…"
                className="w-full rounded-xl border border-slate-300 bg-white p-3.5 font-serif text-[15px] leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              <p className="mt-1 text-xs text-slate-500">{wordCount(text)} słów</p>
            </div>
          )}

          {error && (
            <Alert tone="error" className="mt-4" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Lock className="size-3.5 shrink-0" aria-hidden />
              {ai?.ai ? 'Plik jest odczytywany na Twoim urządzeniu, a tekst umowy zostanie przesłany do oceny przez model AI (OpenAI).' : 'Plik jest odczytywany na Twoim urządzeniu.'}
            </p>
            <Button variant="accent" size="lg" onClick={start} disabled={!text.trim() || reading} icon={<Sparkles className="size-4" />}>
              Analizuj umowę
            </Button>
          </div>
        </Card>
      )}

      {!prep && !busy && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ['Ryzyka i niejasności', 'Zapisy, które mogą działać na Twoją niekorzyść lub być różnie rozumiane.'],
            ['Brakujące postanowienia', 'Typowe elementy, których w umowie nie ma, np. zasady wypowiedzenia.'],
            ['Propozycje brzmienia', 'Gotowe sformułowania, które możesz zaakceptować, edytować lub odrzucić.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl bg-white/70 p-4 ring-1 ring-slate-200/80">
              <p className="font-medium text-ink-900">{t}</p>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
