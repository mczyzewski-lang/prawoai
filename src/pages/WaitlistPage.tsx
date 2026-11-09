import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BadgeCheck, Check, Copy, Gift, Loader2, MessageSquare, PlayCircle, Share2, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { Logo } from '../components/Layout'
import { Button } from '../components/ui'
import { cx } from '../lib/utils'

const PRO_VALUE = 290
const MAX_BONUS = 18
const PREFIXES = [
  { code: '+48', label: 'PL +48' },
  { code: '+49', label: 'DE +49' },
  { code: '+44', label: 'UK +44' },
  { code: '+420', label: 'CZ +420' },
  { code: '+421', label: 'SK +421' },
  { code: '+380', label: 'UA +380' },
  { code: '+370', label: 'LT +370' },
  { code: '+353', label: 'IE +353' },
  { code: '+31', label: 'NL +31' },
  { code: '+1', label: 'US +1' },
]

interface Info {
  launchAt: string
  count: number
  smsDemo: boolean
}

function useInfo() {
  const [info, setInfo] = useState<Info | null>(null)
  useEffect(() => {
    fetch('/api/waitlist/info')
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo({ launchAt: '2027-02-01T10:00:00+01:00', count: 0, smsDemo: true }))
  }, [])
  return info
}

/** Odliczanie do startu. */
function Countdown({ to, compact }: { to: string; compact?: boolean }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const left = Math.max(0, new Date(to).getTime() - now)
  const parts = [
    ['dni', Math.floor(left / 86_400_000)],
    ['godz.', Math.floor(left / 3_600_000) % 24],
    ['min', Math.floor(left / 60_000) % 60],
    ['sek', Math.floor(left / 1000) % 60],
  ] as const
  return (
    <div className={cx('flex gap-2', compact ? 'justify-start' : 'justify-center sm:justify-start')} role="timer" aria-label={`Do startu: ${parts.map(([l, v]) => `${v} ${l}`).join(', ')}`}>
      {parts.map(([label, v]) => (
        <div key={label} className={cx('rounded-2xl bg-white/10 text-center ring-1 ring-white/15 backdrop-blur', compact ? 'w-14 py-1.5' : 'w-[4.5rem] py-3 sm:w-20')}>
          <p className={cx('font-semibold tabular-nums text-white', compact ? 'text-lg' : 'text-3xl sm:text-4xl')}>{String(v).padStart(2, '0')}</p>
          <p className="text-[11px] uppercase tracking-wide text-white/60">{label}</p>
        </div>
      ))}
    </div>
  )
}

function MiniCountdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const left = Math.max(0, new Date(to).getTime() - now)
  const d = Math.floor(left / 86_400_000)
  const hms = [Math.floor(left / 3_600_000) % 24, Math.floor(left / 60_000) % 60, Math.floor(left / 1000) % 60].map((x) => String(x).padStart(2, '0')).join(':')
  return (
    <span role="timer" className="rounded-full bg-white/10 px-3 py-1 font-mono text-sm font-semibold tabular-nums text-white ring-1 ring-white/15">
      {d} d {hms}
    </span>
  )
}

function validNip(nip: string): boolean {
  const d = nip.replace(/\D/g, '')
  if (d.length !== 10) return false
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const sum = w.reduce((acc, x, i) => acc + x * Number(d[i]), 0) % 11
  return sum !== 10 && sum === Number(d[9])
}

/** „01.02.27” – data startu do nagłówka. */
export function startLabel(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`
}

/** Krótkie konfetti przy wejściu (bez bibliotek; wyłączone przy ograniczonym ruchu). */
function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 42 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      dur: 1.6 + Math.random() * 1.2,
      rot: Math.random() * 360,
      color: ['#2fb8a5', '#5ed4c1', '#fbbf24', '#ffffff', '#a78bfa', '#f472b6'][i % 6],
      w: 6 + Math.random() * 6,
    })),
  )
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 3200)
    return () => clearTimeout(t)
  }, [])
  if (!show || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece absolute top-0 block rounded-[2px]" style={{ left: `${p.left}%`, width: p.w, height: p.w * 0.45, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, ['--dx' as string]: `${(p.rot % 2 ? 1 : -1) * (20 + p.rot / 6)}px` }} />
      ))}
    </div>
  )
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-ink-950 via-ink-900 to-ink-800 text-white">
      <div className="pointer-events-none fixed -right-32 -top-32 size-[28rem] rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo light />
        {right ?? <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/15">Lista oczekujących</span>}
      </header>
      <main className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6">{children}</main>
    </div>
  )
}

/** /waitlist – zapis na listę oczekujących: imię, telefon (kod SMS), opcjonalnie NIP. */
export default function WaitlistPage() {
  const info = useInfo()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { code: refParam } = useParams()
  const ref = (refParam ?? params.get('ref') ?? '').toUpperCase()
  const [inviter, setInviter] = useState<string | null>(null)
  useEffect(() => {
    if (!ref) return
    fetch(`/api/waitlist/ref/${encodeURIComponent(ref)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setInviter(d.firstName))
      .catch(() => {})
  }, [ref])

  const [name, setName] = useState('')
  const [prefix, setPrefix] = useState('+48')
  const [number, setNumber] = useState('')
  const [consent, setConsent] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [demoCode, setDemoCode] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [verified, setVerified] = useState(false)
  const [business, setBusiness] = useState<boolean | null>(null)
  const [consentOpen, setConsentOpen] = useState(false)
  const [nip, setNip] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const digits = number.replace(/\D/g, '')
  const phoneOk = prefix === '+48' ? digits.length === 9 : digits.length >= 7 && digits.length <= 13
  const phone = `${prefix}${digits}`
  const nipOk = business === false || (business === true && validNip(nip))

  const post = async (path: string, body: unknown) => {
    const r = await fetch(`/api/waitlist/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw Object.assign(new Error(data.error ?? 'Coś poszło nie tak.'), { data, status: r.status })
    return data
  }

  const sendCode = async () => {
    setError(null)
    setBusy(true)
    try {
      const d = await post('code', { phone })
      setCodeSent(true)
      setDemoCode(d.demo ? d.code : null)
      setCode('')
    } catch (e) {
      const err = e as Error & { data?: { refCode?: string } }
      if (err.data?.refCode) return navigate(`/waitlist/dziekujemy/${err.data.refCode}`)
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Weryfikacja kodu po wpisaniu 6 cyfr
  useEffect(() => {
    if (code.length !== 4 || verified) return
    let cancelled = false
    post('verify', { phone, code })
      .then(() => !cancelled && (setVerified(true), setError(null)))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const join = async () => {
    setError(null)
    setBusy(true)
    try {
      const d = await post('join', { name, phone, consent, business: !!business, nip, ref })
      try {
        sessionStorage.setItem(`prawoai:waitlist:${d.refCode}`, JSON.stringify(d))
      } catch {
        /* tylko podgląd */
      }
      navigate(`/waitlist/dziekujemy/${d.refCode}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell right={info && <span className="rounded-full bg-brand-400/15 px-3 py-1 text-sm font-semibold text-brand-200 ring-1 ring-brand-300/30">Start {startLabel(info.launchAt)}</span>}>
      <div className="grid items-start gap-10 pt-6 lg:grid-cols-[minmax(0,1fr)_28rem] lg:pt-12">
        <section>
          {inviter && (
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-400/15 px-3 py-1.5 text-sm font-medium text-brand-200 ring-1 ring-brand-300/30">
              <Gift className="size-4" aria-hidden /> {inviter} zaprasza Cię do Prawo.ai
            </p>
          )}
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Umowy bez stresu. Startujemy już wkrótce.</h1>
          <p className="mt-4 max-w-xl text-lg text-white/75">Tworzenie i analiza umów z AI, negocjacje z drugą stroną, podpis na ekranie i pilnowanie terminów – z prawnikami PRAVNA.pl w zapleczu.</p>
          <p className="mt-8 flex flex-wrap items-baseline gap-x-3 text-sm font-medium uppercase tracking-[0.18em] text-white/60">
            <span className="text-2xl font-semibold normal-case tracking-tight text-white">Start {info ? startLabel(info.launchAt) : '01.02.27'}</span>
            Do startu zostało
          </p>
          <div className="mt-3">{info ? <Countdown to={info.launchAt} /> : <div className="h-24" />}</div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              [Sparkles, 'Umowa z opisu w 30 sekund'],
              [ShieldCheck, 'Ocena umowy z Twojej perspektywy'],
              [Users, 'Uzgadnianie i podpis z drugą stroną'],
              [BadgeCheck, 'Wzory sprawdzone przez prawników'],
            ].map(([Icon, t]) => {
              const I = Icon as typeof Sparkles
              return (
                <li key={t as string} className="flex items-center gap-2.5 text-sm text-white/85">
                  <span className="grid size-8 place-items-center rounded-lg bg-white/10 text-brand-300" aria-hidden>
                    <I className="size-4" />
                  </span>
                  {t as string}
                </li>
              )
            })}
          </ul>
          {info && info.count > 0 && <p className="mt-6 text-sm text-white/60">Na liście jest już {info.count} {info.count === 1 ? 'osoba' : 'osób'}.</p>}
        </section>

        <section aria-labelledby="wl-form" className="rounded-3xl bg-white p-5 text-ink-900 shadow-2xl sm:p-6">
          <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-sand-50 p-4 ring-1 ring-brand-100">
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-800">
              <Gift className="size-4" aria-hidden /> Dla zapisanych przed startem
            </p>
            <p className="mt-1 text-2xl font-semibold">1 miesiąc Pro gratis</p>
            <p className="text-sm text-slate-600">o wartości {PRO_VALUE} zł – i kolejne za każdą zaproszoną osobę (do {MAX_BONUS} miesięcy).</p>
          </div>
          <h2 id="wl-form" className="mt-5 text-lg font-semibold">Zapisz się na listę</h2>
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!codeSent) void sendCode()
              else if (verified) void join()
            }}
          >
            <div>
              <label htmlFor="wl-name" className="mb-1.5 block text-sm font-medium text-slate-800">
                Imię i nazwisko
              </label>
              <input id="wl-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" disabled={codeSent} className="h-11 w-full rounded-xl border border-slate-300 px-3.5 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50" />
            </div>
            <div>
              <label htmlFor="wl-phone" className="mb-1.5 block text-sm font-medium text-slate-800">
                Numer telefonu
              </label>
              <div className="flex gap-2">
                <label htmlFor="wl-prefix" className="sr-only">
                  Kierunkowy
                </label>
                <select id="wl-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} disabled={codeSent} className="h-11 rounded-xl border border-slate-300 bg-white px-2 text-[15px] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50">
                  {PREFIXES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <input id="wl-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={number} onChange={(e) => setNumber(e.target.value.replace(/[^\d ]/g, '').slice(0, 16))} placeholder={prefix === '+48' ? '600 000 000' : ''} disabled={codeSent} className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3.5 text-[15px] tracking-wide focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50" />
              </div>
            </div>
            {phoneOk &&
              (consent && !consentOpen ? (
                <p className="animate-fade-up flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800 ring-1 ring-brand-100">
                  <Check className="size-4 shrink-0" aria-hidden /> Zgody zaakceptowane
                  <button type="button" onClick={() => setConsentOpen(true)} className="ml-auto text-xs font-medium text-brand-700 underline">
                    Pokaż
                  </button>
                </p>
              ) : (
                <label className="animate-fade-up flex items-start gap-2.5 rounded-xl bg-sand-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => {
                      setConsent(e.target.checked)
                      if (e.target.checked) setConsentOpen(false)
                    }}
                    disabled={codeSent}
                    className="mt-0.5 size-4 shrink-0 accent-brand-600"
                  />
                  <span>Akceptuję regulamin i zgadzam się na otrzymywanie SMS-ów od Prawo.ai w związku z zapisem na listę oczekujących, w tym kodu weryfikacyjnego i informacji o starcie, oraz na przetwarzanie moich danych w tym celu. Zgodę mogę wycofać w każdej chwili.</span>
                </label>
              ))}

            {!codeSent ? (
              <Button type="submit" variant="accent" className="w-full" size="lg" disabled={name.trim().length < 3 || !phoneOk || !consent || busy} icon={busy ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}>
                Wyślij kod SMS
              </Button>
            ) : (
              <div className="animate-fade-up space-y-3">
                {verified ? (
                  <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 ring-1 ring-brand-100">
                    <Check className="size-4" aria-hidden /> Kod potwierdzony
                  </p>
                ) : (
                  <div>
                    <label htmlFor="wl-code" className="mb-1.5 block text-sm font-medium text-slate-800">
                      Kod z SMS-a wysłany na {prefix} {number}
                    </label>
                    <input id="wl-code" inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" className="h-12 w-full rounded-xl border border-slate-300 px-3.5 text-center text-2xl tracking-[0.6em] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
                    {demoCode && <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 ring-1 ring-amber-200">Wersja demo – SMS nie jest jeszcze wysyłany. Twój kod: <span className="font-mono font-semibold">{demoCode}</span></p>}
                    <button type="button" onClick={() => { setCodeSent(false); setDemoCode(null) }} className="mt-1.5 text-xs font-medium text-slate-500 hover:text-ink-900">
                      Zmień numer / wyślij ponownie
                    </button>
                  </div>
                )}

                {verified && (
                  <div className="animate-fade-up space-y-3">
                    <fieldset className="flex items-center justify-between gap-3 rounded-xl bg-sand-50 p-3 ring-1 ring-slate-200">
                      <legend className="sr-only">Czy jesteś przedsiębiorcą?</legend>
                      <span className="text-sm font-medium text-ink-900">Jestem przedsiębiorcą</span>
                      <span className="flex gap-1.5" role="radiogroup" aria-label="Jestem przedsiębiorcą">
                        {([true, false] as const).map((v) => (
                          <button key={String(v)} type="button" role="radio" aria-checked={business === v} onClick={() => setBusiness(v)} className={cx('w-14 rounded-lg py-1.5 text-sm font-semibold ring-1 ring-inset transition', business === v ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-slate-700 ring-slate-300 hover:ring-slate-400')}>
                            {v ? 'Tak' : 'Nie'}
                          </button>
                        ))}
                      </span>
                    </fieldset>
                    {business === true && (
                      <div className="animate-fade-up">
                        <label htmlFor="wl-nip" className="mb-1.5 block text-sm font-medium text-slate-800">
                          NIP
                        </label>
                        <input id="wl-nip" inputMode="numeric" value={nip} onChange={(e) => setNip(e.target.value.replace(/[^\d-]/g, '').slice(0, 13))} placeholder="000-000-00-00" className={cx('h-11 w-full rounded-xl border px-3.5 text-[15px] focus:outline-none focus:ring-4', nip && !nipOk ? 'border-red-400 ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100')} />
                        {nip && !nipOk ? (
                          <p className="mt-1 text-xs text-red-700">Sprawdź NIP – suma kontrolna się nie zgadza.</p>
                        ) : (
                          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-600">
                            <Gift className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden /> Bezpłatne miesiące Pro przypiszemy do konta tej firmy – skorzysta z nich cały Twój zespół.
                          </p>
                        )}
                      </div>
                    )}
                    <Button type="submit" variant="accent" className="w-full" size="lg" disabled={business === null || !nipOk || busy} icon={busy ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}>
                      Zapisuję się i odbieram miesiąc Pro
                    </Button>
                  </div>
                )}
              </div>
            )}
            {error && <p className="text-sm font-medium text-red-700">{error}</p>}
          </form>
          <p className="mt-4 text-xs text-slate-500">Bez opłat i bez karty. Po starcie dostaniesz SMS z linkiem do logowania.</p>
        </section>
      </div>
    </Shell>
  )
}

interface Joined {
  firstName: string
  refCode: string
  position: number
  referrals: number
  potentialMonths: number
  link: string
  sms: string
  launchAt: string
  smsDemo?: boolean
}

/** /waitlist/dziekujemy/:ref – podziękowanie, wideo, link do zaproszeń i mechanika poleceń. */
export function WaitlistThanksPage() {
  const { ref } = useParams()
  const info = useInfo()
  const cached = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`prawoai:waitlist:${ref}`) ?? 'null') as Joined | null
    } catch {
      return null
    }
  }, [ref])
  const [data, setData] = useState<Joined | null>(cached)
  const [missing, setMissing] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    fetch(`/api/waitlist/ref/${encodeURIComponent(ref ?? '')}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setData((cur) => ({ ...cur, ...d })))
      .catch(() => !cached && setMissing(true))
  }, [ref, cached])

  if (missing)
    return (
      <Shell>
        <div className="mx-auto mt-16 max-w-md text-center">
          <p className="text-lg">Nie znaleźliśmy tego zapisu.</p>
          <Link to="/" className="mt-3 inline-block font-semibold text-brand-300 underline">
            Zapisz się na listę
          </Link>
        </div>
      </Shell>
    )
  if (!data)
    return (
      <Shell>
        <div className="grid h-64 place-items-center">
          <Loader2 className="size-6 animate-spin text-white/60" aria-hidden />
        </div>
      </Shell>
    )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* zaznacz ręcznie */
    }
  }
  const shareText = `Dołącz do Prawo.ai przed startem – dostaniesz miesiąc Pro gratis: ${data.link}`

  const launchAt = info?.launchAt ?? data.launchAt
  return (
    <Shell
      right={
        launchAt && (
          <span className="flex items-center gap-2">
            <span className="hidden text-xs font-medium uppercase tracking-[0.14em] text-white/60 sm:inline">Start {startLabel(launchAt)} za</span>
            <MiniCountdown to={launchAt} />
          </span>
        )
      }
    >
      <Confetti />
      <div className="grid gap-8 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:pt-10">
        <section>
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-400/15 px-3 py-1.5 text-sm font-medium text-brand-200 ring-1 ring-brand-300/30">
            <Check className="size-4" aria-hidden /> Jesteś na liście{data.position ? ` · #${data.position}` : ''}
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Dziękujemy, {data.firstName}!</h1>
          <p className="mt-3 max-w-xl text-lg text-white/75">
            Masz już <span className="font-semibold text-white">1 miesiąc Prawo.ai Pro gratis</span> (wartość {PRO_VALUE} zł). Zaproś znajomych i wydłuż go nawet do {MAX_BONUS + 1} miesięcy.
          </p>
          {/* Miejsce na wideo 1:1 */}
          <div className="mt-6 grid aspect-square w-full max-w-md place-items-center overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/15">
            <div className="text-center">
              <PlayCircle className="mx-auto size-14 text-white/70" aria-hidden />
              <p className="mt-2 text-sm text-white/60">Tu pojawi się wideo powitalne (1:1)</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {/* Karta premium: mechanika poleceń */}
          <div className="relative rounded-3xl bg-gradient-to-br from-amber-200 via-amber-400/70 to-brand-400/70 p-px shadow-2xl shadow-black/40">
            <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-[#0d1f24] via-ink-950 to-[#10282c] p-5 sm:p-6">
              <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-amber-300/15 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-brand-400/15 blur-3xl" aria-hidden />
              <p className="relative inline-flex items-center gap-1.5 rounded-full bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200 ring-1 ring-amber-300/30">
                <Gift className="size-3.5" aria-hidden /> Program poleceń
              </p>
              <div className="relative mt-4 flex items-end gap-4">
                <p className="bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-6xl font-bold leading-none tracking-tight text-transparent sm:text-7xl">+1</p>
                <p className="pb-1 text-xl font-semibold leading-tight text-white sm:text-2xl">
                  miesiąc Pro
                  <span className="block text-amber-200">gratis</span>
                </p>
              </div>
              <p className="relative mt-4 text-[15px] leading-relaxed text-white/85">
                za <span className="font-semibold text-white">każdą osobę</span>, która zapisze się z Twojego linku i <span className="font-semibold text-white">zaloguje w ciągu 30 dni od startu</span>.
              </p>
              <div className="relative mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10">
                  <p className="text-[11px] uppercase tracking-wide text-white/55">Maksymalnie</p>
                  <p className="text-lg font-semibold text-white">{MAX_BONUS} miesięcy</p>
                </div>
                <div className="rounded-2xl bg-amber-300/10 px-3 py-2.5 ring-1 ring-amber-300/30">
                  <p className="text-[11px] uppercase tracking-wide text-amber-200/80">Wartość do</p>
                  <p className="text-lg font-semibold text-amber-100">{(MAX_BONUS * PRO_VALUE).toLocaleString('pl-PL', { useGrouping: true })} zł</p>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-3xl bg-white p-5 text-ink-900 shadow-2xl sm:p-6">
            <h2 className="text-lg font-semibold">Twój link do zaproszeń</h2>
            <div className="mt-4 flex gap-2">
              <input readOnly value={data.link} onFocus={(e) => e.target.select()} aria-label="Twój link do zaproszeń" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm" />
              <Button variant="primary" onClick={copy} icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}>
                {copied ? 'Skopiowano' : 'Kopiuj'}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {'share' in navigator && (
                <Button size="sm" variant="secondary" icon={<Share2 className="size-4" />} onClick={() => void navigator.share({ title: 'Prawo.ai', text: shareText, url: data.link }).catch(() => {})}>
                  Udostępnij
                </Button>
              )}
              <a href={`sms:?&body=${encodeURIComponent(shareText)}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-800 ring-1 ring-slate-300 hover:bg-slate-50">
                <MessageSquare className="size-4" aria-hidden /> SMS
              </a>
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-800 ring-1 ring-slate-300 hover:bg-slate-50">
                WhatsApp
              </a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.link)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-800 ring-1 ring-slate-300 hover:bg-slate-50">
                Facebook
              </a>
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/15 sm:p-6">
            <h2 className="font-semibold">Jak to działa</h2>
            <ol className="mt-3 space-y-2.5 text-sm text-white/80">
              {[
                `Za zapis przed startem: 1 miesiąc Pro (${PRO_VALUE} zł).`,
                'Wyślij swój link znajomym i klientom.',
                'Gdy zaproszona osoba zapisze się na listę i zaloguje w ciągu 30 dni od startu – dostajesz +1 miesiąc.',
                `Maksymalnie ${MAX_BONUS} dodatkowych miesięcy.`,
              ].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-500 text-xs font-bold text-ink-950">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-xs text-white/60">Zaproszone osoby</p>
                <p className="text-2xl font-semibold">{data.referrals}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-xs text-white/60">Twoje miesiące Pro</p>
                <p className="text-2xl font-semibold">
                  1{data.potentialMonths ? <span className="text-brand-300"> + {data.potentialMonths}</span> : ''}
                </p>
                {data.potentialMonths > 0 && <p className="text-[11px] text-white/50">dodatkowe po zalogowaniu zaproszonych</p>}
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/15">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="size-4 text-brand-300" aria-hidden /> SMS z Twoim linkiem
            </p>
            <p className="mt-2 rounded-2xl rounded-tl-sm bg-white/10 p-3 text-sm text-white/85">{data.sms}</p>
            {(data.smsDemo ?? info?.smsDemo) && <p className="mt-2 text-xs text-white/50">Wersja demo – po podłączeniu bramki SMS ta wiadomość trafi na Twój telefon.</p>}
          </div>
        </section>
      </div>
    </Shell>
  )
}
