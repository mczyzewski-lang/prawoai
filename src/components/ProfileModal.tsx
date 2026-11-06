import { useEffect, useState } from 'react'
import type { GrammarForm, Profile, SavedParty } from '../types'
import { useStore } from '../store/AppStore'
import { FORM_LABEL, suggestVocative } from '../lib/persona'
import { Button, Modal, TextField } from './ui'
import { PartyFields } from './OwnDataModal'
import { useToast } from './Toast'
import { cx } from '../lib/utils'

const emptyParty: SavedParty = { kind: 'osoba', name: '', address: '', idNumber: '', email: '', representative: '' }

export function FormPicker({ value, onChange }: { value: GrammarForm | undefined; onChange: (f: GrammarForm) => void }) {
  return (
    <div role="radiogroup" aria-label="Forma zwracania się" className="grid gap-2 sm:grid-cols-3">
      {(['f', 'm', 'n'] as GrammarForm[]).map((f) => (
        <button
          key={f}
          type="button"
          role="radio"
          aria-checked={value === f}
          onClick={() => onChange(f)}
          className={cx('rounded-xl px-3 py-2 text-left text-sm ring-1 transition', value === f ? 'bg-brand-50 font-medium text-ink-900 ring-brand-400' : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-300')}
        >
          {FORM_LABEL[f]}
        </button>
      ))}
    </div>
  )
}

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, updateProfile } = useStore()
  const toast = useToast()
  const [p, setP] = useState<Profile>(state.profile)
  const [party, setParty] = useState<SavedParty>(state.profile.ownParty ?? emptyParty)
  const [hasParty, setHasParty] = useState(!!state.profile.ownParty)

  useEffect(() => {
    if (!open) return
    setP({ ...state.profile, addressAs: state.profile.addressAs ?? suggestVocative(state.profile.name) })
    setParty(state.profile.ownParty ?? { ...emptyParty, name: state.profile.name, email: state.profile.email })
    setHasParty(!!state.profile.ownParty)
  }, [open, state.profile])

  const save = () => {
    updateProfile({ ...p, ownParty: hasParty && party.name.trim() ? party : undefined })
    toast('Zapisano profil')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Mój profil"
      description="Te ustawienia wykorzystujemy w rozmowach z asystentem i przy tworzeniu umów."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant="accent" onClick={save}>
            Zapisz
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink-900">Ty</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Imię i nazwisko" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} autoComplete="name" />
            <TextField label="E-mail" type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} autoComplete="email" />
          </div>
          <TextField label="Jak mamy się do Ciebie zwracać?" value={p.addressAs ?? ''} onChange={(e) => setP({ ...p, addressAs: e.target.value })} hint="Np. „Katarzyno”, „Kasiu”, „Michale”. Zostaw puste, jeśli wolisz bez imienia." />
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-800">Formy w komunikatach</p>
            <FormPicker value={p.form} onChange={(form) => setP({ ...p, form })} />
          </div>
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Moje dane do umów i pism</h3>
              <p className="text-xs text-slate-500">Uzupełniamy je automatycznie, gdy jesteś stroną umowy.</p>
            </div>
            {hasParty ? (
              <Button size="sm" variant="ghost" onClick={() => setHasParty(false)}>
                Usuń
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setHasParty(true)}>
                Dodaj dane
              </Button>
            )}
          </div>
          {hasParty && <PartyFields value={party} onChange={setParty} />}
        </section>
      </div>
    </Modal>
  )
}
