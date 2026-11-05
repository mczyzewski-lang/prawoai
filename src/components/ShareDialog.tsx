import { useState } from 'react'
import { Check, Copy, ExternalLink, Eye, Mail, Send } from 'lucide-react'
import type { Contract } from '../types'
import { useStore } from '../store/AppStore'
import { shareContract } from '../lib/contractOps'
import { otherParty, sleep } from '../lib/utils'
import { Alert, Button, Modal, TextArea, TextField } from './ui'
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
