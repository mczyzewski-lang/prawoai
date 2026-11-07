import { useState } from 'react'
import { Check, Copy, Eye, Mail, MessageSquare, PenLine, Send, Trash2, UserPlus } from 'lucide-react'
import type { Collaborator, CollaboratorRole, Contract } from '../types'
import { useStore } from '../store/AppStore'
import { Avatar, Button, Modal, TextField } from './ui'
import { useToast } from './Toast'
import { cx, formatRelative, nowIso, uid } from '../lib/utils'

export const ROLE_LABEL: Record<CollaboratorRole, string> = { komentarze: 'Może komentować', podgląd: 'Tylko podgląd' }

export function teamUrl(token: string) {
  return `${window.location.origin}/zespol/${token}`
}

/** Awatary osób z dostępem (nagłówek umowy). */
export function TeamAvatars({ c, onClick }: { c: Contract; onClick: () => void }) {
  const list = c.collaborators ?? []
  if (!list.length) return null
  return (
    <button type="button" onClick={onClick} className="flex items-center -space-x-2 rounded-full p-0.5 hover:bg-ink-900/5" aria-label={`Osoby z dostępem: ${list.map((x) => x.name).join(', ')}`}>
      {list.slice(0, 4).map((x) => (
        <span key={x.id} className="relative rounded-full ring-2 ring-sand-50" title={`${x.name} · ${x.approvedAt ? 'zatwierdził(a)' : ROLE_LABEL[x.role]}`}>
          <Avatar name={x.name} size="sm" tone="violet" />
          {x.approvedAt && (
            <span className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full bg-brand-600 text-white ring-2 ring-sand-50">
              <Check className="size-2.5" aria-hidden />
            </span>
          )}
        </span>
      ))}
    </button>
  )
}

/**
 * „Udostępnij”: osoby z Twojej strony (np. wspólnik) – przegląd i komentarze przed podpisem;
 * oraz skróty do wysłania umowy drugiej stronie.
 */
export function TeamShareDialog({ c, open, onClose, onSendToSign, onShareOther }: { c: Contract; open: boolean; onClose: () => void; onSendToSign: () => void; onShareOther: () => void }) {
  const { state, updateContract } = useStore()
  const toast = useToast()
  const list = c.collaborators ?? []
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<CollaboratorRole>('komentarze')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const isSigned = c.stage === 'signed'

  const setList = (fn: (l: Collaborator[]) => Collaborator[], log?: string) =>
    updateContract(c.id, (x) => ({ ...x, collaborators: fn(x.collaborators ?? []), activity: log ? [...x.activity, { id: uid('a'), at: nowIso(), text: log, partyId: x.ownerPartyId, internal: true }] : x.activity }))

  const add = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Podaj poprawny adres e-mail.')
    if (list.some((x) => x.email.toLowerCase() === email.trim().toLowerCase())) return setError('Ta osoba ma już dostęp.')
    const person: Collaborator = { id: uid('cb'), token: uid('t').replace('t_', ''), name: name.trim() || email.trim().split('@')[0], email: email.trim(), role, invitedAt: nowIso() }
    setList((l) => [...l, person], `${state.profile.name} udostępnił(a) umowę: ${person.name} (${ROLE_LABEL[role].toLowerCase()})`)
    setName('')
    setEmail('')
    setError(null)
    const msg = `Dzień dobry,\n\nudostępniam Ci umowę „${c.title}” do przejrzenia przed podpisaniem. ${role === 'komentarze' ? 'Możesz dodać komentarze przy zapisach i zatwierdzić umowę.' : 'Możesz ją przeczytać.'}\n\n${teamUrl(person.token)}\n\n${state.profile.name}`
    window.location.href = `mailto:${encodeURIComponent(person.email)}?subject=${encodeURIComponent(`Umowa do przeglądu: ${c.title}`)}&body=${encodeURIComponent(msg)}`
    toast(`Udostępniono: ${person.name}`)
  }

  const copy = async (x: Collaborator) => {
    try {
      await navigator.clipboard.writeText(teamUrl(x.token))
      setCopied(x.id)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast('Nie udało się skopiować linku.', 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={`Udostępnij „${c.title}”`} description="Pokaż umowę osobom ze swojej strony – np. wspólnikowi lub księgowej – zanim ją podpiszesz. Ich komentarze widzisz tylko Ty, nie druga strona.">
      <div className="space-y-5">
        {!isSigned && (
          <form
            className="grid gap-2 sm:grid-cols-[1fr_1.2fr_auto_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
          >
            <TextField label="Imię i nazwisko" value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Jan Wspólnik" optional />
            <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error ?? undefined} placeholder="wspolnik@firma.pl" />
            <div>
              <label htmlFor="team-role" className="mb-1.5 block text-sm font-medium text-slate-800">
                Uprawnienia
              </label>
              <select id="team-role" value={role} onChange={(e) => setRole(e.target.value as CollaboratorRole)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100">
                {(Object.keys(ROLE_LABEL) as CollaboratorRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="accent" className="h-11" icon={<UserPlus className="size-4" />}>
              Udostępnij
            </Button>
          </form>
        )}

        <section aria-label="Osoby z dostępem">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Osoby z dostępem</p>
          <ul className="mt-2 divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">
            <li className="flex items-center gap-3 px-3 py-2.5">
              <Avatar name={state.profile.name} size="sm" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-medium text-ink-900">{state.profile.name} (Ty)</span>
                <span className="block truncate text-xs text-slate-500">{state.profile.email}</span>
              </span>
              <span className="text-xs text-slate-500">Właściciel</span>
            </li>
            {list.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <Avatar name={x.name} size="sm" tone="violet" />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium text-ink-900">{x.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {x.email} · {x.approvedAt ? <span className="font-medium text-brand-700">zatwierdził(a) {formatRelative(x.approvedAt)}</span> : `zaproszono ${formatRelative(x.invitedAt)}`}
                  </span>
                </span>
                <label htmlFor={`role-${x.id}`} className="sr-only">
                  Uprawnienia: {x.name}
                </label>
                <select id={`role-${x.id}`} value={x.role} onChange={(e) => setList((l) => l.map((y) => (y.id === x.id ? { ...y, role: e.target.value as CollaboratorRole } : y)))} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm">
                  {(Object.keys(ROLE_LABEL) as CollaboratorRole[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" icon={copied === x.id ? <Check className="size-4" /> : <Copy className="size-4" />} onClick={() => copy(x)}>
                  {copied === x.id ? 'Skopiowano' : 'Link'}
                </Button>
                <Button variant="ghost" size="sm" aria-label={`Odbierz dostęp: ${x.name}`} icon={<Trash2 className="size-4" />} onClick={() => setList((l) => l.filter((y) => y.id !== x.id), `${state.profile.name} odebrał(a) dostęp: ${x.name}`)} />
              </li>
            ))}
          </ul>
          {list.length === 0 && <p className="mt-2 text-sm text-slate-500">Nikt poza Tobą nie ma jeszcze dostępu.</p>}
          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            <li className="flex gap-1.5">
              <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Komentarze Twojego zespołu są wewnętrzne – druga strona umowy ich nie zobaczy.
            </li>
            <li className="flex gap-1.5">
              <Eye className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Udostępnione osoby nie widzą Twoich rozmów z asystentem ani uwag AI.
            </li>
          </ul>
        </section>

        {!isSigned && (
          <section aria-label="Druga strona umowy" className="rounded-2xl bg-sand-50 p-4 ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-ink-900">Druga strona umowy</p>
            <p className="mt-0.5 text-sm text-slate-600">Gdy umowa jest gotowa, wyślij ją kontrahentowi.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" icon={<PenLine className="size-4" />} onClick={onSendToSign}>
                Wyślij do podpisu
              </Button>
              <Button size="sm" variant="secondary" icon={c.shareId ? <Mail className="size-4" /> : <Send className="size-4" />} onClick={onShareOther}>
                {c.shareId ? 'Link dla drugiej strony' : 'Wyślij do wglądu i komentarzy'}
              </Button>
            </div>
          </section>
        )}
      </div>
    </Modal>
  )
}

/** Pasek dla osoby z zespołu (np. wspólnika): komentarze i zatwierdzenie umowy. */
export function CollaboratorBar({ c, person }: { c: Contract; person: Collaborator }) {
  const { updateContract } = useStore()
  const toast = useToast()
  const owner = c.parties.find((p) => p.id === c.ownerPartyId)
  const approve = (yes: boolean) => {
    updateContract(c.id, (x) => ({
      ...x,
      collaborators: (x.collaborators ?? []).map((y) => (y.id === person.id ? { ...y, approvedAt: yes ? nowIso() : undefined } : y)),
      activity: [...x.activity, { id: uid('a'), at: nowIso(), text: `${person.name} ${yes ? 'zatwierdził(a) umowę przed podpisem' : 'wycofał(a) zatwierdzenie'}`, partyId: x.ownerPartyId, internal: true }],
    }))
    toast(yes ? 'Zatwierdzono – właściciel umowy zobaczy to od razu' : 'Wycofano zatwierdzenie')
  }
  return (
    <div className={cx('mb-4 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 ring-1', person.approvedAt ? 'bg-brand-50 ring-brand-200' : 'bg-violet-50 ring-violet-200')}>
      <p className="min-w-0 flex-1 text-sm text-slate-700">
        <span className="font-semibold text-ink-900">{owner?.name || 'Właściciel umowy'}</span> udostępnia Ci umowę do przeglądu przed podpisaniem.{' '}
        {person.role === 'komentarze' ? 'Kliknij zapis, aby dodać komentarz – zobaczy go tylko Twój zespół.' : 'Masz dostęp tylko do podglądu.'}
      </p>
      {person.role === 'komentarze' &&
        (person.approvedAt ? (
          <Button size="sm" variant="ghost" onClick={() => approve(false)}>
            Wycofaj zatwierdzenie
          </Button>
        ) : (
          <Button size="sm" variant="accent" icon={<Check className="size-4" />} onClick={() => approve(true)}>
            Zatwierdzam umowę
          </Button>
        ))}
    </div>
  )
}
