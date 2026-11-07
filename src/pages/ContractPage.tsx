import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FileQuestion, Link2Off, LogOut, ShieldCheck, UserPlus } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Workspace } from '../components/workspace/Workspace'
import { GuestLayout } from '../components/Layout'
import { Alert, Avatar, Button, ButtonLink, EmptyState, Modal, TextField } from '../components/ui'
import { useToast } from '../components/Toast'
import type { Contract } from '../types'
import { nowIso, otherParty, uid } from '../lib/utils'

export function OwnerContractPage() {
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
  return <Workspace contract={c} viewer={c.ownerPartyId} viewerName={state.profile.name} isOwner hasAccount requireAccount={() => {}} signPath={`/umowy/${c.id}/podpis`} />
}

/** Hook dla widoku kontrahenta: konto gościa + modal rejestracji. */
export function useGuest(c: Contract | undefined) {
  const { state, setGuestAccount, updateContract } = useStore()
  const toast = useToast()
  const account = c?.shareId ? state.guestAccounts[c.shareId] : undefined
  const [modal, setModal] = useState<string | null>(null)
  const pending = useRef<(() => void) | null>(null)

  // Jednorazowy wpis „otworzył(a) dokument” na sesję.
  useEffect(() => {
    if (!c?.shareId) return
    const key = `prawoai:opened:${c.shareId}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    const who = account?.name ?? c.invite?.name ?? 'Druga strona'
    updateContract(c.id, (x) => ({ ...x, activity: [...x.activity, { id: uid('a'), at: nowIso(), text: `${who} otworzył(a) dokument` }] }))
    // Celowo tylko przy zmianie linku.
  }, [c?.shareId]) // eslint-disable-line react-hooks/exhaustive-deps

  const modalEl = c ? (
    <AccountModal
      reason={modal}
      onClose={() => {
        pending.current = null
        setModal(null)
      }}
      defaultName={c.invite?.name ?? ''}
      defaultEmail={c.invite?.email ?? ''}
      onCreate={(name, email) => {
        setGuestAccount(c.shareId!, { name, email, createdAt: nowIso() })
        updateContract(c.id, (x) => ({ ...x, activity: [...x.activity, { id: uid('a'), at: nowIso(), text: `${name} założył(a) konto i dołączył(a) do negocjacji`, partyId: otherParty(x.ownerPartyId) }] }))
        setModal(null)
        toast('Konto utworzone – możesz teraz zgłaszać zmiany')
        const next = pending.current
        pending.current = null
        if (next) setTimeout(next, 0)
      }}
    />
  ) : null

  const requireAccount = (reason: string, then?: () => void) => {
    pending.current = then ?? null
    setModal(reason)
  }

  return { account, requireAccount, modalEl, logout: () => c?.shareId && setGuestAccount(c.shareId, null) }
}

export function SharedContractPage() {
  const { shareId } = useParams()
  const { getByShareId } = useStore()
  const c = getByShareId(shareId ?? '')
  const { account, requireAccount, modalEl, logout } = useGuest(c)

  if (!c) {
    return (
      <GuestLayout>
        <EmptyState icon={<Link2Off className="size-6" />} title="Link jest nieaktywny" className="mx-auto mt-10 max-w-lg">
          Dokument mógł zostać usunięty przez autora albo link jest niepełny. Poproś drugą stronę o ponowne przesłanie zaproszenia.
        </EmptyState>
      </GuestLayout>
    )
  }
  const viewer = otherParty(c.ownerPartyId)
  const owner = c.parties.find((p) => p.id === c.ownerPartyId)!
  const viewerName = account?.name ?? c.invite?.name ?? c.parties.find((p) => p.id === viewer)!.name

  return (
    <GuestLayout
      right={
        account ? (
          <div className="flex items-center gap-2">
            <Avatar name={account.name} size="sm" tone="violet" />
            <span className="hidden text-sm font-medium text-ink-900 sm:inline">{account.name}</span>
            <Button variant="ghost" size="sm" aria-label="Wyloguj" onClick={logout} icon={<LogOut className="size-4" />} />
          </div>
        ) : (
          <Button variant="primary" size="sm" icon={<UserPlus className="size-4" />} onClick={() => requireAccount('Załóż konto, aby zapisać dokument, zgłaszać zmiany i korzystać z własnego asystenta.')}>
            Załóż konto
          </Button>
        )
      }
    >
      {c.invite?.purpose === 'sign' && c.stage !== 'signed' && !c.signatures.some((sg) => sg.partyId === viewer) ? (
        <Alert tone="info" title={`${owner.name || 'Druga strona'} prosi Cię o podpisanie umowy`} className="mb-5">
          Przeczytaj umowę i podpisz ją na ekranie – palcem na telefonie lub myszką.{' '}
          <button type="button" className="font-semibold underline" onClick={() => document.getElementById('podpisy')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            Przejdź do podpisu
          </button>
        </Alert>
      ) : !account && (
        <Alert tone="info" title={`${owner.name} udostępnia Ci projekt umowy`} className="mb-5">
          Możesz przeczytać cały dokument bez rejestracji. Aby zapisać go u siebie, zgłaszać zmiany lub korzystać z własnego asystenta, załóż bezpłatne konto.
        </Alert>
      )}
      <Workspace contract={c} viewer={viewer} viewerName={viewerName} isOwner={false} hasAccount={!!account} requireAccount={requireAccount} signPath={`/d/${c.shareId}/podpis`} />
      {modalEl}
    </GuestLayout>
  )
}

function AccountModal({ reason, onClose, onCreate, defaultName, defaultEmail }: { reason: string | null; onClose: () => void; onCreate: (name: string, email: string) => void; defaultName: string; defaultEmail: string }) {
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submit = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Podaj imię i nazwisko.'
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Podaj poprawny adres e-mail.'
    if (!agree) e.agree = 'Zaakceptuj warunki korzystania z serwisu.'
    setErrors(e)
    if (Object.keys(e).length === 0) onCreate(name.trim(), email.trim())
  }
  return (
    <Modal
      open={!!reason}
      onClose={onClose}
      title="Załóż bezpłatne konto"
      description={reason ?? undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Nie teraz
          </Button>
          <Button variant="accent" onClick={submit}>
            Utwórz konto
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <TextField label="Imię i nazwisko" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" />
        <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="email" />
        <label className="flex items-start gap-2.5 text-sm text-slate-700">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" aria-invalid={!!errors.agree || undefined} />
          <span>
            Akceptuję warunki korzystania z serwisu i zasady przetwarzania danych.
            {errors.agree && <span className="mt-0.5 block text-xs font-medium text-red-700">{errors.agree}</span>}
          </span>
        </label>
        <p className="flex gap-2 rounded-xl bg-sand-50 p-3 text-xs text-slate-600">
          <ShieldCheck className="size-4 shrink-0 text-brand-700" aria-hidden />
          Twoje prywatne pytania do asystenta nie będą widoczne dla drugiej strony.
        </p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}

/** Umowa udostępniona osobie z zespołu właściciela (np. wspólnikowi) – przegląd przed podpisem. */
export function TeamContractPage() {
  const { token } = useParams()
  const { state } = useStore()
  const c = state.contracts.find((x) => x.collaborators?.some((y) => y.token === token))
  const person = c?.collaborators?.find((y) => y.token === token)
  // Wspólny link zespołu: po podaniu imienia osoba dołącza do listy z uprawnieniami linku.
  const viaLink = state.contracts.find((x) => x.teamLink?.enabled && x.teamLink.token === token)
  if (!person && viaLink) return <JoinByLink c={viaLink} />
  if (!c || !person) {
    return (
      <GuestLayout>
        <EmptyState icon={<Link2Off className="size-6" />} title="Link jest nieaktywny" className="mx-auto mt-10 max-w-lg">
          Dostęp mógł zostać odebrany. Poproś właściciela umowy o ponowne udostępnienie.
        </EmptyState>
      </GuestLayout>
    )
  }
  return (
    <GuestLayout
      right={
        <div className="flex items-center gap-2">
          <Avatar name={person.name} size="sm" tone="violet" />
          <span className="hidden text-sm font-medium text-ink-900 sm:inline">{person.name}</span>
        </div>
      }
    >
      <Workspace contract={c} viewer={c.ownerPartyId} viewerName={person.name} isOwner={false} hasAccount requireAccount={() => {}} signPath={`/umowy/${c.id}/podpis`} collaborator={person} />
    </GuestLayout>
  )
}

function JoinByLink({ c }: { c: Contract }) {
  const { updateContract } = useStore()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const owner = c.parties.find((p) => p.id === c.ownerPartyId)
  const join = () => {
    const token = uid('t').replace('t_', '')
    updateContract(c.id, (x) => ({
      ...x,
      collaborators: [...(x.collaborators ?? []), { id: uid('cb'), token, name: name.trim(), email: '', role: x.teamLink!.role, invitedAt: nowIso(), viaLink: true }],
      activity: [...x.activity, { id: uid('a'), at: nowIso(), text: `${name.trim()} dołączył(a) przez link`, partyId: x.ownerPartyId, internal: true }],
    }))
    navigate(`/zespol/${token}`, { replace: true })
  }
  return (
    <GuestLayout>
      <div className="mx-auto mt-10 max-w-md rounded-3xl bg-white p-6 ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Umowa do przeglądu</p>
        <h1 className="mt-1 text-xl font-semibold text-ink-900">{c.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{owner?.name || 'Właściciel umowy'} udostępnia Ci umowę przed podpisaniem. Podaj imię, żeby było wiadomo, kto dodaje komentarze.</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) join()
          }}
        >
          <TextField label="Imię i nazwisko" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Button type="submit" variant="accent" className="w-full" disabled={!name.trim()}>
            Otwórz umowę
          </Button>
        </form>
      </div>
    </GuestLayout>
  )
}
