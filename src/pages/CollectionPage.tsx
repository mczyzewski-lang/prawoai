import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Banknote, Check, CircleDollarSign, FileText, Gavel, Mail, MessageSquare, Plus, Printer, Scale, Trash2, Upload } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Alert, Button, EmptyState, Modal, PageHeader, TextArea, TextField } from '../components/ui'
import { useToast } from '../components/Toast'
import { calcCase, demandText, parseInvoiceText, printDocument, RATES, recommend, reminderText, STATUS_LABEL, STATUS_ORDER, zl } from '../lib/collection'
import { collectContacts, mentionSubtitle } from '../lib/contractAssistant'
import { extractText, ExtractError } from '../lib/extract'
import { cx, formatDate, formatDateTime, nowIso, uid } from '../lib/utils'
import type { DebtCase, DebtEvent, DebtInvoice, DebtStatus, SavedParty } from '../types'

const STATUS_TONE: Record<DebtStatus, string> = {
  nowa: 'bg-slate-100 text-slate-700',
  przypomnienie: 'bg-amber-50 text-amber-800',
  wezwanie: 'bg-orange-50 text-orange-800',
  ugoda: 'bg-violet-50 text-violet-800',
  spłacona: 'bg-brand-50 text-brand-800',
  'u prawnika': 'bg-ink-900 text-white',
}

const ev = (kind: DebtEvent['kind'], text: string): DebtEvent => ({ id: uid('de'), at: nowIso(), kind, text })

/** /windykacja – lista spraw. */
export default function CollectionPage() {
  const { id } = useParams()
  if (id === 'nowa') return <NewCase />
  if (id) return <CaseView id={id} />
  return <CaseList />
}

function CaseList() {
  const { state } = useStore()
  const cases = state.debtCases ?? []
  return (
    <div>
      <PageHeader
        eyebrow="Windykacja"
        title="Zaległe płatności"
        description="Od przypomnienia, przez wezwanie do zapłaty, po przekazanie sprawy prawnikowi PRAVNA.pl. Odsetki i rekompensatę wyliczamy automatycznie."
        actions={
          <Link to="/windykacja/nowa" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
            <Plus className="size-4" aria-hidden /> Nowa sprawa
          </Link>
        }
      />
      {cases.length === 0 ? (
        <EmptyState icon={<CircleDollarSign className="size-6" />} title="Nie masz spraw windykacyjnych" action={<Link to="/windykacja/nowa" className="font-semibold text-brand-700 hover:underline">Dodaj zaległą fakturę</Link>}>
          Gdy w „Terminach” minie termin płatności, zobaczysz przy nim „Rozpocznij windykację”. Możesz też dodać należność ręcznie albo z pliku faktury.
        </EmptyState>
      ) : (
        <ul className="grid gap-2.5">
          {cases.map((c) => {
            const calc = calcCase(c)
            return (
              <li key={c.id}>
                <Link to={`/windykacja/${c.id}`} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 transition hover:ring-brand-300">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sand-100 text-ink-700" aria-hidden>
                    <Banknote className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink-900">{c.debtor.name}</span>
                    <span className="block truncate text-sm text-slate-500">
                      {c.invoices.length} {c.invoices.length === 1 ? 'faktura' : 'faktury'} · {zl(calc.principal)} · {calc.maxDaysLate} dni opóźnienia
                    </span>
                  </span>
                  <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_TONE[c.status])}>{STATUS_LABEL[c.status]}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const emptyDebtor: SavedParty = { kind: 'firma', name: '', address: '', idNumber: '', email: '', representative: '' }

/** Krok 1: należność – dłużnik, faktury, powiązana umowa. */
function NewCase() {
  const { state, upsertDebtCase } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const contract = state.contracts.find((c) => c.id === params.get('umowa'))
  const deadline = contract?.deadlines?.find((d) => d.id === params.get('termin'))
  const contacts = useMemo(() => collectContacts(state.profile.ownParty, state.contracts, state.dataBook).filter((m) => m.data && m.label !== state.profile.ownParty?.name), [state])
  const otherFromContract = contract?.parties.find((p) => p.id !== contract.ownerPartyId)
  const [debtor, setDebtor] = useState<SavedParty>(otherFromContract ? { kind: otherFromContract.kind, name: otherFromContract.name, address: otherFromContract.address, idNumber: otherFromContract.idNumber, email: otherFromContract.email, representative: otherFromContract.representative } : emptyDebtor)
  const amountFromTitle = deadline ? Number((deadline.title.match(/(\d[\d\s]*(?:,\d{2})?)\s*zł/)?.[1] ?? '').replace(/\s/g, '').replace(',', '.')) || 0 : 0
  const [invoices, setInvoices] = useState<DebtInvoice[]>([{ id: uid('di'), number: '', amount: amountFromTitle, dueDate: deadline?.date ?? '' }])
  const [disputed, setDisputed] = useState(false)
  const [account, setAccount] = useState('')
  const [reading, setReading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const b2b = debtor.kind === 'firma' && state.profile.ownParty?.kind !== 'osoba'
  const valid = debtor.name.trim() && invoices.length > 0 && invoices.every((i) => i.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(i.dueDate))

  const setInv = (id: string, patch: Partial<DebtInvoice>) => setInvoices((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  const create = () => {
    const dc: DebtCase = { id: uid('dc'), createdAt: nowIso(), updatedAt: nowIso(), contractId: contract?.id, debtor: { ...debtor, name: debtor.name.trim() }, invoices, b2b, disputed, status: 'nowa', account: account.trim(), events: [ev('utworzono', `Dodano należność: ${invoices.map((i) => i.number || 'faktura').join(', ')}`)] }
    upsertDebtCase(dc)
    navigate(`/windykacja/${dc.id}`, { replace: true })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/windykacja" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Windykacja
      </Link>
      <PageHeader eyebrow="Nowa sprawa" title="Zaległa płatność" description={contract ? `Z umowy „${contract.title}”${deadline ? ` – termin: ${deadline.title}` : ''}.` : 'Wskaż dłużnika i faktury. Odsetki i kolejny krok wyliczymy automatycznie.'} />

      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
        <h2 className="font-semibold text-ink-900">Dłużnik</h2>
        {contacts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {contacts.slice(0, 8).map((m) => (
              <button key={m.label} type="button" onClick={() => setDebtor({ ...emptyDebtor, ...m.data })} className={cx('rounded-full px-3 py-1.5 text-sm ring-1 ring-inset', debtor.name === m.data!.name ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-slate-700 ring-slate-300 hover:ring-slate-400')} title={mentionSubtitle(m)}>
                {m.label}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="Nazwa / imię i nazwisko" value={debtor.name} onChange={(e) => setDebtor({ ...debtor, name: e.target.value })} />
          <TextField label="NIP / PESEL" value={debtor.idNumber} onChange={(e) => setDebtor({ ...debtor, idNumber: e.target.value })} optional />
          <TextField label="Adres" value={debtor.address} onChange={(e) => setDebtor({ ...debtor, address: e.target.value })} optional className="sm:col-span-2" />
          <TextField label="E-mail" type="email" value={debtor.email} onChange={(e) => setDebtor({ ...debtor, email: e.target.value })} optional />
          <div className="flex items-end gap-2 pb-1">
            {(['firma', 'osoba'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={debtor.kind === k} onClick={() => setDebtor({ ...debtor, kind: k })} className={cx('rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-inset', debtor.kind === k ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-slate-700 ring-slate-300')}>
                {k === 'firma' ? 'Firma' : 'Osoba prywatna'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-ink-900">Faktury</h2>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50">
            <Upload className="size-4" aria-hidden /> {reading ? 'Odczytuję…' : 'Wgraj fakturę (PDF)'}
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                setReading(true)
                setFileError(null)
                try {
                  const p = parseInvoiceText(await extractText(f))
                  const inv: DebtInvoice = { id: uid('di'), number: p.number ?? f.name.replace(/\.[^.]+$/, ''), amount: p.amount ?? 0, dueDate: p.dueDate ?? '' }
                  setInvoices((xs) => (xs.length === 1 && !xs[0].number && !xs[0].amount ? [inv] : [...xs, inv]))
                  if (!p.amount || !p.dueDate) setFileError('Nie udało się odczytać wszystkich danych z faktury – uzupełnij kwotę lub termin.')
                } catch (err) {
                  setFileError(err instanceof ExtractError ? err.message : 'Nie udało się odczytać pliku.')
                } finally {
                  setReading(false)
                  e.target.value = ''
                }
              }}
            />
          </label>
        </div>
        {fileError && <p className="mt-2 text-sm text-amber-800">{fileError}</p>}
        <ul className="mt-3 space-y-2">
          {invoices.map((inv) => (
            <li key={inv.id} className="grid gap-2 rounded-xl bg-sand-50 p-3 sm:grid-cols-[1fr_9rem_10rem_auto] sm:items-end">
              <TextField label="Numer faktury" value={inv.number} onChange={(e) => setInv(inv.id, { number: e.target.value })} placeholder="np. FV/12/2026" />
              <TextField label="Kwota brutto (zł)" inputMode="decimal" value={inv.amount ? String(inv.amount).replace('.', ',') : ''} onChange={(e) => setInv(inv.id, { amount: Number(e.target.value.replace(/\s/g, '').replace(',', '.')) || 0 })} />
              <TextField label="Termin płatności" type="date" value={inv.dueDate} onChange={(e) => setInv(inv.id, { dueDate: e.target.value })} />
              <Button variant="ghost" size="sm" aria-label="Usuń fakturę" icon={<Trash2 className="size-4" />} disabled={invoices.length === 1} onClick={() => setInvoices((xs) => xs.filter((x) => x.id !== inv.id))} />
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" className="mt-2" icon={<Plus className="size-4" />} onClick={() => setInvoices((xs) => [...xs, { id: uid('di'), number: '', amount: 0, dueDate: '' }])}>
          Dodaj fakturę
        </Button>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <TextField label="Numer rachunku do wpłaty" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="np. 12 3456 …" optional />
          <label className="flex items-center gap-2.5 self-end rounded-xl bg-amber-50 px-3 py-2.5 text-sm ring-1 ring-amber-200">
            <input type="checkbox" checked={disputed} onChange={(e) => setDisputed(e.target.checked)} className="size-4 accent-brand-600" />
            Dłużnik kwestionuje należność (spór)
          </label>
        </div>
      </section>

      <div className="mt-5 flex justify-end">
        <Button variant="accent" size="lg" disabled={!valid} icon={<Scale className="size-4" />} onClick={create}>
          Oceń sprawę
        </Button>
      </div>
    </div>
  )
}

/** Kroki 2–4: ocena, przypomnienie, wezwanie; status sprawy i historia. */
function CaseView({ id }: { id: string }) {
  const { state, upsertDebtCase, deleteDebtCase } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const c = (state.debtCases ?? []).find((x) => x.id === id)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [demandOpen, setDemandOpen] = useState(false)
  if (!c) return <EmptyState icon={<Banknote className="size-6" />} title="Nie znaleziono sprawy" action={<Link to="/windykacja" className="font-semibold text-brand-700 hover:underline">Wróć do listy</Link>} />
  const calc = calcCase(c)
  const rec = recommend(c, calc)
  const contract = state.contracts.find((x) => x.id === c.contractId)
  // Wierzyciel: Twoja strona w powiązanej umowie, a bez umowy – Twoje dane z profilu.
  const own = contract?.parties.find((p) => p.id === contract.ownerPartyId)
  const creditor: SavedParty = own?.name ? { kind: own.kind, name: own.name, address: own.address, idNumber: own.idNumber, email: own.email, representative: own.representative } : (state.profile.ownParty ?? { kind: 'osoba', name: state.profile.name, address: '', idNumber: '', email: state.profile.email, representative: '' })
  const update = (patch: Partial<DebtCase>, event?: DebtEvent) => upsertDebtCase({ ...c, ...patch, updatedAt: nowIso(), events: event ? [...c.events, event] : c.events })

  return (
    <div>
      <Link to="/windykacja" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Windykacja
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_TONE[c.status])}>{STATUS_LABEL[c.status]}</span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">{c.debtor.name}</h1>
          <p className="text-sm text-slate-600">
            {c.b2b ? 'Transakcja handlowa (B2B)' : 'Należność od osoby prywatnej'}
            {contract && (
              <>
                {' · '}
                <Link to={`/umowy/${contract.id}`} className="font-medium text-brand-700 hover:underline">
                  {contract.title}
                </Link>
              </>
            )}
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={() => { deleteDebtCase(c.id); navigate('/windykacja') }}>
          Usuń sprawę
        </Button>
      </div>

      <ol className="mt-5 flex items-center gap-2 text-xs" aria-label="Etap sprawy">
        {STATUS_ORDER.map((s, i) => {
          const at = STATUS_ORDER.indexOf(c.status === 'u prawnika' ? 'wezwanie' : c.status)
          return (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span className={cx('grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold', i < at || c.status === 'spłacona' ? 'bg-brand-600 text-white' : i === at ? 'bg-ink-900 text-white' : 'bg-slate-200 text-slate-500')}>{i < at || c.status === 'spłacona' ? <Check className="size-3" aria-hidden /> : i + 1}</span>
              <span className={cx('hidden font-medium sm:inline', i <= at ? 'text-ink-900' : 'text-slate-500')}>{STATUS_LABEL[s]}</span>
              {i < STATUS_ORDER.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
            </li>
          )
        })}
      </ol>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200" aria-labelledby="calc-h">
            <h2 id="calc-h" className="font-semibold text-ink-900">Ocena sprawy</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Należność', zl(calc.principal)],
                ['Odsetki', zl(calc.interest)],
                ['Rekompensata', c.b2b ? zl(calc.compensation) : '—'],
                ['Razem', zl(calc.total)],
              ].map(([k, v], i) => (
                <div key={k} className={cx('rounded-xl px-3 py-2.5', i === 3 ? 'bg-ink-900 text-white' : 'bg-sand-50')}>
                  <p className={cx('text-xs', i === 3 ? 'text-white/70' : 'text-slate-500')}>{k}</p>
                  <p className="mt-0.5 font-semibold tabular-nums">{v}</p>
                </div>
              ))}
            </div>
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-1 font-medium">Faktura</th>
                  <th className="py-1 font-medium">Termin</th>
                  <th className="py-1 text-right font-medium">Opóźnienie</th>
                  <th className="py-1 text-right font-medium">Kwota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calc.rows.map((r) => (
                  <tr key={r.inv.id}>
                    <td className="py-1.5">{r.inv.number || 'faktura'}</td>
                    <td className="py-1.5">{formatDate(r.inv.dueDate)}</td>
                    <td className={cx('py-1.5 text-right tabular-nums', r.daysLate > 0 && 'font-medium text-red-700')}>{r.daysLate} dni</td>
                    <td className="py-1.5 text-right tabular-nums">{zl(r.inv.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-500">
              Odsetki {c.b2b ? 'za opóźnienie w transakcjach handlowych' : 'ustawowe za opóźnienie'}: {calc.rate.toLocaleString('pl-PL')}% rocznie (przyjęta stopa referencyjna NBP {RATES.nbpReference.toLocaleString('pl-PL')}% – sprawdź aktualną){c.b2b ? `; rekompensata 40/70/100 EUR po kursie ${RATES.eurPln.toLocaleString('pl-PL')} zł` : ''}. Wyliczenia są szacunkowe.
            </p>
            {calc.limitation && (
              <p className={cx('mt-2 flex items-center gap-1.5 text-sm', calc.limitationDays !== null && calc.limitationDays < 180 ? 'font-medium text-red-700' : 'text-slate-600')}>
                <AlertTriangle className="size-4 shrink-0" aria-hidden /> Przedawnienie najwcześniej {formatDate(calc.limitation)} – po tym dniu dochodzenie należności w sądzie będzie utrudnione.
              </p>
            )}
            {c.disputed && <Alert tone="warning" className="mt-3">Dłużnik kwestionuje należność – przed wezwaniem warto zebrać dowody wykonania umowy i korespondencję.</Alert>}
          </section>

          <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200" aria-labelledby="hist-h">
            <h2 id="hist-h" className="font-semibold text-ink-900">Historia sprawy</h2>
            <ol className="mt-3 space-y-2.5">
              {[...c.events].reverse().map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" aria-hidden />
                  <span>
                    <span className="text-ink-900">{e.text}</span>
                    <span className="block text-xs text-slate-500">{formatDateTime(e.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start" aria-label="Kolejny krok">
          <div className="rounded-2xl bg-brand-50/70 p-4 ring-1 ring-brand-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">Rekomendowany krok</p>
            <p className="mt-1 font-semibold text-ink-900">{rec.title}</p>
            <p className="mt-1 text-sm text-slate-700">{rec.why}</p>
          </div>
          {c.status !== 'spłacona' && c.status !== 'u prawnika' && (
            <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <Button className="w-full" variant={rec.step === 'przypomnienie' ? 'accent' : 'secondary'} icon={<Mail className="size-4" />} onClick={() => setReminderOpen(true)}>
                Wyślij przypomnienie
              </Button>
              <Button className="w-full" variant={rec.step === 'wezwanie' ? 'accent' : 'secondary'} icon={<FileText className="size-4" />} onClick={() => setDemandOpen(true)}>
                Wezwanie do zapłaty
              </Button>
              <Button className="w-full" variant={rec.step === 'prawnik' ? 'accent' : 'ghost'} icon={<Gavel className="size-4" />} onClick={() => { update({ status: 'u prawnika' }, ev('status', 'Przekazano sprawę prawnikowi PRAVNA.pl (wersja demonstracyjna)')); toast('Sprawa oznaczona jako przekazana prawnikowi') }}>
                Przekaż prawnikowi PRAVNA.pl
              </Button>
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" size="sm" variant="ghost" onClick={() => update({ status: 'ugoda' }, ev('status', 'Uzgodniono ugodę / plan spłaty'))}>
                  Ugoda / raty
                </Button>
                <Button className="flex-1" size="sm" variant="ghost" icon={<Check className="size-4" />} onClick={() => { update({ status: 'spłacona' }, ev('wpłata', 'Należność spłacona')); toast('Sprawa zamknięta – należność spłacona') }}>
                  Spłacona
                </Button>
              </div>
            </div>
          )}
          {(c.status === 'spłacona' || c.status === 'u prawnika') && (
            <Button className="w-full" variant="ghost" size="sm" onClick={() => update({ status: 'nowa' }, ev('status', 'Wznowiono sprawę'))}>
              Wznów sprawę
            </Button>
          )}
        </aside>
      </div>

      {reminderOpen && <ReminderModal c={c} creditorName={creditor.name} onClose={() => setReminderOpen(false)} onSent={(via) => { update({ status: c.status === 'nowa' ? 'przypomnienie' : c.status }, ev('przypomnienie', `Wysłano przypomnienie (${via})`)); setReminderOpen(false) }} />}
      {demandOpen && (
        <Modal
          open
          size="lg"
          onClose={() => setDemandOpen(false)}
          title="Przedsądowe wezwanie do zapłaty"
          description="Sprawdź treść, wydrukuj lub zapisz jako PDF i wyślij dłużnikowi (e-mailem lub listem poleconym)."
          footer={
            <>
              <Button variant="secondary" onClick={() => setDemandOpen(false)}>
                Zamknij
              </Button>
              {c.debtor.email && (
                <Button variant="secondary" icon={<Mail className="size-4" />} onClick={() => { const d = demandText(c, calc, creditor); window.location.href = `mailto:${encodeURIComponent(c.debtor.email)}?subject=${encodeURIComponent('Przedsądowe wezwanie do zapłaty')}&body=${encodeURIComponent(d.paragraphs.join('\n\n'))}`; update({ status: 'wezwanie' }, ev('wezwanie', 'Wysłano wezwanie do zapłaty e-mailem')) }}>
                  Wyślij e-mailem
                </Button>
              )}
              <Button variant="accent" icon={<Printer className="size-4" />} onClick={() => { const d = demandText(c, calc, creditor); printDocument(d.title, d.paragraphs); update({ status: 'wezwanie' }, ev('wezwanie', 'Przygotowano wezwanie do zapłaty (wydruk / PDF)')) }}>
                Drukuj / PDF
              </Button>
            </>
          }
        >
          {!own?.name && !state.profile.ownParty && <Alert tone="warning" className="mb-3">Uzupełnij swoje dane w „Mój profil i dane” – pojawią się w wezwaniu jako dane wierzyciela.</Alert>}
          <div className="max-h-[55vh] overflow-y-auto rounded-xl bg-paper p-5 font-serif text-[14.5px] leading-relaxed text-slate-800 ring-1 ring-slate-200">
            {demandText(c, calc, creditor).paragraphs.map((p, i, all) => (
              <div key={i}>
                <p className={cx('mb-2 whitespace-pre-line', i === 0 && 'text-right', i === all.length - 1 && 'mt-6 text-right')}>{p}</p>
                {i === 2 && <p className="my-4 text-center font-semibold tracking-wide">PRZEDSĄDOWE WEZWANIE DO ZAPŁATY</p>}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

function ReminderModal({ c, creditorName, onClose, onSent }: { c: DebtCase; creditorName: string; onClose: () => void; onSent: (via: string) => void }) {
  const [via, setVia] = useState<'email' | 'sms'>(c.debtor.email ? 'email' : 'sms')
  const [to, setTo] = useState(c.debtor.email)
  const [phone, setPhone] = useState('')
  const [text, setText] = useState(reminderText(c, creditorName))
  const send = () => {
    if (via === 'email') window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent('Przypomnienie o płatności')}&body=${encodeURIComponent(text)}`
    else window.location.href = `sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(text)}`
    onSent(via === 'email' ? 'e-mail' : 'SMS')
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Przypomnienie o płatności"
      description="Uprzejma wiadomość – otworzy się w Twojej poczcie albo aplikacji SMS."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant="accent" icon={via === 'email' ? <Mail className="size-4" /> : <MessageSquare className="size-4" />} disabled={via === 'email' ? !/^\S+@\S+\.\S+$/.test(to) : phone.replace(/\D/g, '').length < 9} onClick={send}>
            {via === 'email' ? 'Wyślij e-mailem' : 'Wyślij SMS-em'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          {(['email', 'sms'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={via === k} onClick={() => setVia(k)} className={cx('rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-inset', via === k ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-slate-700 ring-slate-300')}>
              {k === 'email' ? 'E-mail' : 'SMS'}
            </button>
          ))}
        </div>
        {via === 'email' ? <TextField label="E-mail dłużnika" type="email" value={to} onChange={(e) => setTo(e.target.value)} /> : <TextField label="Telefon dłużnika" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+48 600 000 000" />}
        <TextArea label="Treść" rows={9} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
    </Modal>
  )
}
