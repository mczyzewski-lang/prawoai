import { useEffect, useRef, useState } from 'react'
import { Eraser, MessageSquareText, PenLine, ShieldCheck, Smartphone } from 'lucide-react'
import type { Contract, GrammarForm, Party, Signature } from '../types'
import { adapt } from '../lib/persona'
import { SignaturePad, typedSignatureDataUrl, type SignaturePadHandle } from './SignaturePad'
import { Button, Modal, Tabs, TextField } from './ui'
import { nowIso } from '../lib/utils'

type Mode = 'draw' | 'sms'

function prefersTouch(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768
}

function maskPhone(p: string): string {
  const d = p.replace(/\D/g, '')
  return d.length >= 3 ? `+48 ••• ••• ${d.slice(-3)}` : p
}

/**
 * Podpis pod umową: na telefonie – palcem, na komputerze – kodem SMS (z możliwością narysowania myszką).
 * SMS działa w trybie demonstracyjnym: kod jest generowany lokalnie i pokazywany w podglądzie wiadomości.
 */
export function SignModal({ open, onClose, c, party, defaultName, onSigned, form }: { open: boolean; onClose: () => void; c: Contract; party: Party; defaultName: string; onSigned: (sig: Signature) => void; form?: GrammarForm }) {
  const [mode, setMode] = useState<Mode>('draw')
  const [name, setName] = useState(defaultName)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [empty, setEmpty] = useState(true)
  const [phone, setPhone] = useState('')
  const [sentCode, setSentCode] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [busy, setBusy] = useState(false)
  const padRef = useRef<SignaturePadHandle>(null)

  useEffect(() => {
    if (!open) return
    setMode(prefersTouch() ? 'draw' : 'sms')
    setName(defaultName)
    setConfirm(false)
    setError(null)
    setSentCode(null)
    setCode('')
  }, [open, defaultName])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((x) => x - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const version = c.versions.length

  const sendCode = async () => {
    setError(null)
    if (phone.replace(/\D/g, '').length < 9) return setError('Podaj poprawny numer telefonu (9 cyfr).')
    setBusy(true)
    await new Promise((r) => setTimeout(r, 700))
    setSentCode(String(Math.floor(100000 + Math.random() * 900000)))
    setCode('')
    setCooldown(30)
    setBusy(false)
  }

  const submit = async () => {
    setError(null)
    if (!name.trim()) return setError('Podaj imię i nazwisko osoby podpisującej.')
    if (!confirm) return setError(`Potwierdź, że akceptujesz treść umowy w wersji ${version}.`)
    let dataUrl: string | null
    let method: Signature['method']
    if (mode === 'draw') {
      dataUrl = padRef.current?.toDataURL() ?? null
      if (!dataUrl) return setError('Złóż podpis w polu powyżej.')
      method = 'drawn'
    } else {
      if (!sentCode) return setError('Najpierw wyślij kod SMS.')
      if (code.replace(/\s/g, '') !== sentCode) return setError('Kod jest nieprawidłowy. Sprawdź wiadomość SMS i spróbuj ponownie.')
      dataUrl = await typedSignatureDataUrl(name.trim())
      method = 'sms'
    }
    onSigned({ partyId: party.id, signerName: name.trim(), dataUrl, signedAt: nowIso(), method, phone: method === 'sms' ? maskPhone(phone) : undefined })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Podpisz umowę"
      description={`${party.role}: ${party.name} · wersja ${version}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant="accent" onClick={submit} loading={busy} icon={<ShieldCheck className="size-4" />}>
            Podpisz
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Tabs<Mode>
          label="Sposób podpisu"
          value={mode}
          onChange={(m) => {
            setMode(m)
            setError(null)
          }}
          className="w-fit"
          tabs={[
            { id: 'sms', label: 'Kod SMS', icon: <MessageSquareText className="size-4" aria-hidden /> },
            { id: 'draw', label: 'Narysuj podpis', icon: <PenLine className="size-4" aria-hidden /> },
          ]}
        />
        <TextField label="Imię i nazwisko podpisującego" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />

        {mode === 'draw' ? (
          <div>
            <SignaturePad ref={padRef} onChange={setEmpty} label={`Pole podpisu: ${party.role}`} />
            <Button size="sm" variant="ghost" className="mt-1" icon={<Eraser className="size-3.5" />} onClick={() => padRef.current?.clear()} disabled={empty}>
              Wyczyść
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <TextField className="flex-1" label="Numer telefonu" type="tel" inputMode="tel" autoComplete="tel" placeholder="+48 600 000 000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Button variant="secondary" onClick={sendCode} loading={busy} disabled={cooldown > 0} className="shrink-0">
                {sentCode ? (cooldown > 0 ? `Wyślij ponownie (${cooldown})` : 'Wyślij ponownie') : 'Wyślij kod'}
              </Button>
            </div>
            {sentCode && (
              <>
                <div className="animate-fade-up rounded-2xl bg-slate-900 p-3 text-white shadow-lg">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/60">
                    <Smartphone className="size-3.5" aria-hidden /> SMS · Prawo.ai · teraz
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">
                    Kod do podpisania umowy „{c.title}”: <span className="font-mono text-base font-semibold tracking-widest">{sentCode}</span>. Nie przekazuj go nikomu.
                  </p>
                  <p className="mt-1.5 text-[11px] text-white/50">Podgląd wiadomości – w wersji demonstracyjnej SMS nie jest wysyłany.</p>
                </div>
                <TextField label="Kod z SMS" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ''))} />
              </>
            )}
          </div>
        )}

        <label className="flex items-start gap-2.5 text-sm text-slate-700">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
          <span>{adapt('Zapoznałem(-am) się', form)} z treścią umowy w wersji {version} i ją akceptuję.</span>
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <p className="text-xs leading-relaxed text-slate-500">Podpis jest zapisywany razem z datą i skrótem treści dokumentu. Nie jest to kwalifikowany podpis elektroniczny.</p>
      </div>
    </Modal>
  )
}
