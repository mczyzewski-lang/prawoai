import { useState } from 'react'
import { Check, Copy, ExternalLink, Eye, Link2, Mail, MessageSquare, PenLine, Send, Share2 } from 'lucide-react'
import type { Contract } from '../types'
import { useStore } from '../store/AppStore'
import { shareContract } from '../lib/contractOps'
import { otherParty, sleep } from '../lib/utils'
import { Alert, Button, Modal, Tabs, TextArea, TextField } from './ui'
import { cx } from '../lib/utils'
import { useToast } from './Toast'

export function shareUrl(shareId: string) {
  return `${window.location.origin}/d/${shareId}`
}

export function ShareDialog({ contract, open, onClose }: { contract: Contract; open: boolean; onClose: () => void }) {
  const { state, updateContract } = useStore()
  const toast = useToast()
  const other = contract.parties.find((p) => p.id === otherParty(contract.ownerPartyId))!
  const [name, setName] = useState(contract.invite?.name ?? (other.kind === 'firma' ? other.representative : other.name) ?? '')
  const [email, setEmail] = useState(contract.invite?.email ?? other.email ?? '')
  const [message, setMessage] = useState(contract.invite?.message ?? `Dzień dobry, przesyłam projekt umowy „${contract.title}” do wglądu. Możesz go przeczytać bez zakładania konta i zaproponować zmiany.`)
  const [errors, setErrors] = useState<{ email?: string }>({})
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const shared = !!contract.shareId && !!contract.invite

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErrors({ email: 'Podaj poprawny adres e-mail kontrahenta.' })
      return
    }
    setErrors({})
    setSending(true)
    await sleep(700)
    updateContract(contract.id, (c) => shareContract(c, { name: name.trim(), email: email.trim(), message: message.trim() }, state.profile.name))
    setSending(false)
    toast('Zaproszenie zostało przygotowane')
  }

  const copy = async () => {
    if (!contract.shareId) return
    try {
      await navigator.clipboard.writeText(shareUrl(contract.shareId))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Nie udało się skopiować. Zaznacz link i skopiuj go ręcznie.', 'error')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={shared ? 'Dokument udostępniony' : 'Zaproś drugą stronę do negocjacji'}
      description={shared ? `Kontrahent: ${contract.invite?.name || contract.invite?.email}` : 'Kontrahent zobaczy dokument bez zakładania konta.'}
      footer={
        shared ? (
          <Button variant="primary" onClick={onClose}>
            Gotowe
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Anuluj
            </Button>
            <Button variant="accent" onClick={submit} loading={sending} icon={<Send className="size-4" />}>
              Wyślij zaproszenie
            </Button>
          </>
        )
      }
    >
      {shared && contract.shareId ? (
        <div className="space-y-4">
          <Alert tone="success" title="Link jest aktywny">
            Każda osoba z tym linkiem może przeczytać umowę. Aby zgłaszać zmiany, kontrahent założy bezpłatne konto.
          </Alert>
          <div>
            <label htmlFor="share-link" className="mb-1.5 block text-sm font-medium text-slate-800">
              Link do dokumentu
            </label>
            <div className="flex gap-2">
              <input id="share-link" readOnly value={shareUrl(contract.shareId)} onFocus={(e) => e.target.select()} className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700" />
              <Button variant="secondary" onClick={copy} icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}>
                {copied ? 'Skopiowano' : 'Kopiuj'}
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <a
              href={`mailto:${encodeURIComponent(contract.invite?.email ?? '')}?subject=${encodeURIComponent(`Projekt umowy: ${contract.title}`)}&body=${encodeURIComponent(`${contract.invite?.message ?? ''}\n\n${shareUrl(contract.shareId)}`)}`}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-800 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <Mail className="size-4" aria-hidden /> Wyślij z własnej poczty
            </a>
            <a href={`/d/${contract.shareId}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-800 ring-1 ring-slate-200 hover:bg-slate-50">
              <Eye className="size-4" aria-hidden /> Zobacz jako kontrahent <ExternalLink className="ml-auto size-3.5 text-slate-400" aria-hidden />
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <TextField label="Imię i nazwisko osoby kontaktowej" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" optional />
          <TextField label="E-mail kontrahenta" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required inputMode="email" />
          <TextArea label="Wiadomość" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} optional />
          <ul className="space-y-1.5 rounded-xl bg-sand-50 p-3 text-sm text-slate-700">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> Kontrahent zobaczy dokument i wspólne komentarze.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> Twoje prywatne notatki i rozmowy z asystentem pozostaną niewidoczne.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> Od teraz zmiany wprowadzacie jako propozycje do akceptacji.
            </li>
          </ul>
        </div>
      )}
    </Modal>
  )
}

type Channel = 'link' | 'email' | 'sms'

/** Link prowadzący kontrahenta prosto do podpisów pod umową. */
export function signUrl(shareId: string) {
  return `${shareUrl(shareId)}#podpisy`
}

/**
 * „Wyślij do podpisu”: link do skopiowania, e-mail albo SMS do kontrahenta.
 * Wiadomość otwiera się w poczcie / aplikacji SMS użytkownika (automatyczna wysyłka wymaga usługi po stronie serwera).
 */
export function SendToSignDialog({ contract, open, onClose }: { contract: Contract; open: boolean; onClose: () => void }) {
  const { state, updateContract } = useStore()
  const toast = useToast()
  const other = contract.parties.find((p) => p.id === otherParty(contract.ownerPartyId))!
  const [channel, setChannel] = useState<Channel>('link')
  const [name, setName] = useState(contract.invite?.name || (other.kind === 'firma' ? other.representative || other.name : other.name) || '')
  const [email, setEmail] = useState(contract.invite?.email || other.email || '')
  const [phone, setPhone] = useState(contract.invite?.phone ?? '')
  const [message, setMessage] = useState(`Dzień dobry, przesyłam umowę „${contract.title}” do podpisu. Możesz ją przeczytać i podpisać na ekranie telefonu lub komputera – bez instalowania czegokolwiek.`)
  const [error, setError] = useState<string | null>(null)
  const [sentVia, setSentVia] = useState<Channel | null>(null)
  const [copied, setCopied] = useState(false)

  const ensureShared = () => {
    // Identyfikator linku liczymy od razu (potrzebny do treści wiadomości), zapis – przez aktualizację umowy.
    const next = shareContract(contract, { name: name.trim(), email: email.trim(), phone: phone.trim(), message: message.trim(), purpose: 'sign' }, state.profile.name)
    updateContract(contract.id, (c) => ({ ...c, shareId: next.shareId, stage: next.stage, invite: next.invite, parties: next.parties, activity: next.activity }))
    return next.shareId
  }

  const link = contract.shareId ? signUrl(contract.shareId) : ''
  const digits = phone.replace(/[^\d+]/g, '')

  const send = () => {
    setError(null)
    if (channel === 'email' && !/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Podaj poprawny adres e-mail kontrahenta.')
    if (channel === 'sms' && digits.replace(/\D/g, '').length < 9) return setError('Podaj numer telefonu kontrahenta (min. 9 cyfr).')
    const id = ensureShared()
    const url = id ? signUrl(id) : ''
    if (channel === 'email') {
      window.location.href = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(`Umowa do podpisu: ${contract.title}`)}&body=${encodeURIComponent(`${message.trim()}\n\n${url}`)}`
    } else if (channel === 'sms') {
      window.location.href = `sms:${digits}?&body=${encodeURIComponent(`${message.trim()} ${url}`)}`
    }
    setSentVia(channel)
    toast(channel === 'link' ? 'Link do podpisu jest gotowy' : channel === 'email' ? 'Otwieramy Twoją pocztę z gotową wiadomością' : 'Otwieramy wiadomość SMS z gotową treścią')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Nie udało się skopiować. Zaznacz link i skopiuj go ręcznie.', 'error')
    }
  }

  const done = !!sentVia && !!contract.shareId

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Wyślij do podpisu"
      description={`${other.name || 'Druga strona'} otworzy umowę bez zakładania aplikacji i podpisze ją na ekranie – palcem na telefonie lub myszką.`}
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            Gotowe
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Anuluj
            </Button>
            <Button variant="accent" onClick={send} icon={channel === 'link' ? <Link2 className="size-4" /> : channel === 'email' ? <Mail className="size-4" /> : <MessageSquare className="size-4" />}>
              {channel === 'link' ? 'Utwórz link do podpisu' : channel === 'email' ? 'Wyślij e-mailem' : 'Wyślij SMS-em'}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-4">
          <Alert tone="success" title={sentVia === 'link' ? 'Link do podpisu jest aktywny' : 'Wiadomość jest gotowa do wysłania'}>
            {sentVia === 'link' ? 'Wyślij go kontrahentowi dowolnym komunikatorem.' : sentVia === 'email' ? 'Jeśli poczta się nie otworzyła, skopiuj link poniżej.' : 'Jeśli aplikacja SMS się nie otworzyła, skopiuj link poniżej.'} Gdy kontrahent podpisze, zobaczysz to w umowie.
          </Alert>
          <div>
            <label htmlFor="sign-link" className="mb-1.5 block text-sm font-medium text-slate-800">
              Link do podpisu
            </label>
            <div className="flex gap-2">
              <input id="sign-link" readOnly value={link} onFocus={(e) => e.target.select()} className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700" />
              <Button variant="secondary" onClick={copy} icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}>
                {copied ? 'Skopiowano' : 'Kopiuj'}
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button type="button" onClick={() => void navigator.share({ title: `Umowa do podpisu: ${contract.title}`, text: message, url: link }).catch(() => {})} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-800 ring-1 ring-slate-200 hover:bg-slate-50">
                <Share2 className="size-4" aria-hidden /> Udostępnij…
              </button>
            )}
            <a href={signUrl(contract.shareId!).replace(window.location.origin, '')} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-800 ring-1 ring-slate-200 hover:bg-slate-50">
              <Eye className="size-4" aria-hidden /> Zobacz jako kontrahent <ExternalLink className="ml-auto size-3.5 text-slate-400" aria-hidden />
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Tabs<Channel>
            label="Sposób wysłania"
            value={channel}
            onChange={(c) => {
              setChannel(c)
              setError(null)
            }}
            tabs={[
              { id: 'link', label: 'Link', icon: <Link2 className="size-4" aria-hidden /> },
              { id: 'email', label: 'E-mail', icon: <Mail className="size-4" aria-hidden /> },
              { id: 'sms', label: 'SMS', icon: <MessageSquare className="size-4" aria-hidden /> },
            ]}
            className="w-fit"
          />
          <TextField label="Imię i nazwisko osoby podpisującej" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" optional />
          {channel === 'email' && <TextField label="E-mail kontrahenta" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error ?? undefined} />}
          {channel === 'sms' && <TextField label="Telefon kontrahenta" type="tel" inputMode="tel" placeholder="+48 600 000 000" value={phone} onChange={(e) => setPhone(e.target.value)} error={error ?? undefined} />}
          {channel !== 'link' && <TextArea label="Wiadomość" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />}
          <ul className={cx('space-y-1.5 rounded-xl bg-sand-50 p-3 text-sm text-slate-700')}>
            <li className="flex gap-2">
              <PenLine className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> Link prowadzi prosto do miejsca na podpis pod umową.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> Twoje prywatne notatki i rozmowy z asystentem pozostaną niewidoczne.
            </li>
            {channel !== 'link' && (
              <li className="flex gap-2">
                <Send className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> {channel === 'email' ? 'Wiadomość otworzy się w Twojej poczcie – wystarczy kliknąć „Wyślij”.' : 'Wiadomość otworzy się w aplikacji SMS na Twoim telefonie.'}
              </li>
            )}
          </ul>
        </div>
      )}
    </Modal>
  )
}
