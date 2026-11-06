import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Download, Eraser, FileQuestion, FileSignature, Info, Keyboard, Link2Off, PenLine, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { useStore } from '../store/AppStore'
import type { Contract, Party, PartyId } from '../types'
import { addSignature, removeSignature } from '../lib/contractOps'
import { documentHash, downloadContractPdf } from '../lib/pdf'
import { cx, formatDateTime, nowIso, otherParty } from '../lib/utils'
import { SignaturePad, typedSignatureDataUrl, type SignaturePadHandle } from '../components/SignaturePad'
import { Alert, Button, ButtonLink, Card, EmptyState, StatusBadge, Tabs, TextField } from '../components/ui'
import { GuestLayout } from '../components/Layout'
import { useToast } from '../components/Toast'
import { useGuest } from './ContractPage'
import { ClauseBody, ClauseHeading, DocumentHeader, PartiesColumns, SignatureStrip } from '../components/workspace/DocumentParts'
import { isPartiesClause, partiesClauseIsGenerated } from '../lib/documentFormat'
import { displayStatus } from '../lib/utils'

export function OwnerSignPage() {
  const { id } = useParams()
  const { getContract, state } = useStore()
  const c = getContract(id ?? '')
  if (!c) {
    return (
      <EmptyState icon={<FileQuestion className="size-6" />} title="Nie znaleziono dokumentu" action={<ButtonLink to="/umowy">Wróć do Moich umów</ButtonLink>}>
        Dokument mógł zostać usunięty albo link jest nieprawidłowy.
      </EmptyState>
    )
  }
  return <SignView c={c} viewer={c.ownerPartyId} viewerName={state.profile.name} canSignFor={['A', 'B']} backTo={`/umowy/${c.id}`} />
}

export function SharedSignPage() {
  const { shareId } = useParams()
  const { getByShareId } = useStore()
  const c = getByShareId(shareId ?? '')
  const { account, requireAccount, modalEl } = useGuest(c)
  if (!c) {
    return (
      <GuestLayout>
        <EmptyState icon={<Link2Off className="size-6" />} title="Link jest nieaktywny" className="mx-auto mt-10 max-w-lg">
          Poproś drugą stronę o ponowne przesłanie zaproszenia.
        </EmptyState>
      </GuestLayout>
    )
  }
  const viewer = otherParty(c.ownerPartyId)
  return (
    <GuestLayout>
      {!account && (
        <Alert tone="info" className="mb-5" title="Aby podpisać umowę, załóż bezpłatne konto">
          <Button className="mt-2" size="sm" variant="primary" icon={<UserPlus className="size-4" />} onClick={() => requireAccount('Konto pozwala potwierdzić, kto złożył podpis, i zapisać kopię umowy.')}>
            Załóż konto
          </Button>
        </Alert>
      )}
      <SignView c={c} viewer={viewer} viewerName={account?.name ?? c.invite?.name ?? ''} canSignFor={account ? [viewer] : []} backTo={`/d/${c.shareId}`} />
      {modalEl}
    </GuestLayout>
  )
}

function SignView({ c, viewer, viewerName, canSignFor, backTo }: { c: Contract; viewer: PartyId; viewerName: string; canSignFor: PartyId[]; backTo: string }) {
  const toast = useToast()
  const [hash, setHash] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const ready = c.stage === 'agreed' || c.stage === 'signed'

  useEffect(() => {
    void documentHash(c).then(setHash)
  }, [c])

  const pdf = async () => {
    setPdfBusy(true)
    try {
      await downloadContractPdf(c)
      toast('Pobrano plik PDF')
    } catch {
      toast('Nie udało się wygenerować pliku PDF. Spróbuj ponownie.', 'error')
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link to={backTo} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Wróć do umowy
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Finalizacja</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">{c.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={displayStatus(c, viewer)} />
            <span className="text-xs text-slate-500">Wersja {c.versions.length}</span>
          </div>
        </div>
        <Button variant={c.stage === 'signed' ? 'accent' : 'secondary'} onClick={pdf} loading={pdfBusy} icon={<Download className="size-4" />}>
          {c.stage === 'signed' ? 'Pobierz podpisany PDF' : 'Pobierz PDF'}
        </Button>
      </div>

      {!ready ? (
        <EmptyState icon={<FileSignature className="size-6" />} title="Umowa nie jest jeszcze uzgodniona" action={<ButtonLink to={`${backTo}?panel=negocjacje`}>Przejdź do negocjacji</ButtonLink>}>
          Podpisy można złożyć, gdy obie strony zaakceptują tę samą wersję dokumentu i nie będzie otwartych propozycji.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="overflow-hidden">
            <div className="max-h-[75vh] overflow-y-auto bg-paper" tabIndex={0} aria-label="Finalna treść umowy">
              <DocumentHeader c={c} />
              <div className="divide-y divide-slate-200/60">
                {c.clauses.map((cl, i) => (
                  <section key={cl.id} className="px-5 py-5 sm:px-10">
                    <h3>
                      <ClauseHeading index={i} title={cl.title} />
                    </h3>
                    {isPartiesClause(c, i) ? (
                      <div className="mt-4">
                        <PartiesColumns parties={c.parties} />
                        <p className="mt-3 text-center font-serif text-[14px] italic text-slate-500">zwanymi dalej łącznie „Stronami”</p>
                        {!partiesClauseIsGenerated(c, cl) && <ClauseBody text={cl.text} className="mt-4 text-[14.5px]" />}
                      </div>
                    ) : (
                      <ClauseBody text={cl.text} className="mt-3" />
                    )}
                  </section>
                ))}
              </div>
              <SignatureStrip c={c} />
            </div>
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Skrót treści (SHA-256): <code className="break-all text-slate-700">{hash || 'obliczanie…'}</code>
            </div>
          </Card>

          <div className="space-y-4">
            {c.stage === 'signed' && (
              <Alert tone="success" title="Umowa podpisana przez obie strony">
                Pobierz finalny dokument PDF i zachowaj go w bezpiecznym miejscu.
              </Alert>
            )}
            {c.parties.map((p) => (
              <SignatureCard key={p.id} c={c} party={p} isMe={p.id === viewer} canSign={canSignFor.includes(p.id)} defaultName={p.id === viewer ? viewerName : p.kind === 'firma' ? p.representative || p.name : p.name} />
            ))}
            <p className="flex gap-2 rounded-xl bg-white p-3 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200">
              <Info className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
              Podpis na ekranie to odwzorowanie podpisu odręcznego zapisane razem z datą i skrótem treści dokumentu. Nie jest to kwalifikowany podpis elektroniczny. Jeśli dla danej umowy prawo wymaga szczególnej formy, skorzystaj z podpisu kwalifikowanego lub formy pisemnej.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function SignatureCard({ c, party, isMe, canSign, defaultName }: { c: Contract; party: Party; isMe: boolean; canSign: boolean; defaultName: string }) {
  const { updateContract } = useStore()
  const toast = useToast()
  const sig = c.signatures.find((s) => s.partyId === party.id)
  const padRef = useRef<SignaturePadHandle>(null)
  const [name, setName] = useState(defaultName)
  const [mode, setMode] = useState<'draw' | 'type'>('draw')
  const [empty, setEmpty] = useState(true)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError(null)
    if (!name.trim()) return setError('Podaj imię i nazwisko osoby podpisującej.')
    if (!confirm) return setError('Potwierdź, że zapoznałeś(-aś) się z treścią umowy.')
    let dataUrl: string | null = null
    if (mode === 'draw') {
      dataUrl = padRef.current?.toDataURL() ?? null
      if (!dataUrl) return setError('Złóż podpis w polu powyżej.')
    } else dataUrl = await typedSignatureDataUrl(name.trim())
    setBusy(true)
    updateContract(c.id, (x) => addSignature(x, { partyId: party.id, signerName: name.trim(), dataUrl: dataUrl!, signedAt: nowIso(), method: mode === 'draw' ? 'drawn' : 'typed' }))
    setBusy(false)
    toast('Podpis został złożony')
  }

  return (
    <Card className={cx('p-4 sm:p-5', sig && 'ring-brand-300')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {party.role} {isMe && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 normal-case tracking-normal text-brand-800">Ty</span>}
          </p>
          <p className="font-semibold text-ink-900">{party.name}</p>
        </div>
        {sig ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
            <Check className="size-3.5" aria-hidden /> Podpisano
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Oczekuje</span>
        )}
      </div>

      {sig ? (
        <div className="mt-3">
          <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
            <img src={sig.dataUrl} alt={`Podpis: ${sig.signerName}`} className="mx-auto h-24 object-contain" />
          </div>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-medium text-ink-900">{sig.signerName}</span> · {formatDateTime(sig.signedAt)}
          </p>
          <p className="text-xs text-slate-500">{sig.method === 'drawn' ? 'Podpis odręczny na ekranie' : 'Podpis wpisany na ekranie'}</p>
          {canSign && c.stage !== 'signed' && (
            <Button size="sm" variant="ghost" className="mt-2" icon={<Trash2 className="size-3.5" />} onClick={() => updateContract(c.id, (x) => removeSignature(x, party.id))}>
              Usuń i podpisz ponownie
            </Button>
          )}
        </div>
      ) : canSign ? (
        <div className="mt-4 space-y-3">
          {!isMe && (
            <p className="flex gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
              <Info className="size-4 shrink-0" aria-hidden />
              Podpis drugiej strony na Twoim urządzeniu – np. przy spotkaniu osobiście. Druga strona może też podpisać przez swój link.
            </p>
          )}
          <TextField label="Imię i nazwisko podpisującego" value={name} onChange={(e) => setName(e.target.value)} />
          <Tabs<'draw' | 'type'>
            label="Sposób złożenia podpisu"
            value={mode}
            onChange={setMode}
            className="w-fit"
            tabs={[
              { id: 'draw', label: 'Narysuj', icon: <PenLine className="size-4" aria-hidden /> },
              { id: 'type', label: 'Wpisz', icon: <Keyboard className="size-4" aria-hidden /> },
            ]}
          />
          {mode === 'draw' ? (
            <>
              <SignaturePad ref={padRef} onChange={setEmpty} label={`Pole podpisu: ${party.role}`} />
              <Button size="sm" variant="ghost" icon={<Eraser className="size-3.5" />} onClick={() => padRef.current?.clear()} disabled={empty}>
                Wyczyść
              </Button>
            </>
          ) : (
            <div className="grid h-28 place-items-center rounded-xl bg-white px-4 ring-1 ring-slate-300">
              <p className="truncate font-hand text-4xl text-ink-900">{name || 'Twoje imię i nazwisko'}</p>
            </div>
          )}
          <label className="flex items-start gap-2.5 text-sm text-slate-700">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
            <span>Zapoznałem(-am) się z treścią umowy w wersji {c.versions.length} i ją akceptuję.</span>
          </label>
          {error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <Button variant="accent" className="w-full" loading={busy} onClick={submit} icon={<FileSignature className="size-4" />}>
            Złóż podpis
          </Button>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <ShieldCheck className="size-4" aria-hidden /> {isMe ? 'Załóż konto, aby podpisać.' : 'Druga strona podpisze przez swój link.'}
        </p>
      )}
    </Card>
  )
}
