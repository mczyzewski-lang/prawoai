import { useEffect, useState } from 'react'
import { BookmarkCheck, Building2, User } from 'lucide-react'
import type { PartyKind, SavedParty } from '../types'
import { Button, Modal, TextField } from './ui'
import { cx } from '../lib/utils'

/** Przełącznik (switch) dostępny z klawiatury. */
export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-brand-50/60 p-3 ring-1 ring-brand-100">
      <span>
        <span className="block text-sm font-medium text-ink-900">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-400" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

export function PartyFields({ value, onChange }: { value: SavedParty; onChange: (v: SavedParty) => void }) {
  const set = (patch: Partial<SavedParty>) => onChange({ ...value, ...patch })
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Rodzaj strony" className="flex w-fit rounded-xl bg-slate-100 p-1">
        {(['osoba', 'firma'] as PartyKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value.kind === k}
            onClick={() => set({ kind: k })}
            className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium', value.kind === k ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600')}
          >
            {k === 'osoba' ? <User className="size-3.5" aria-hidden /> : <Building2 className="size-3.5" aria-hidden />}
            {k === 'osoba' ? 'Osoba' : 'Firma'}
          </button>
        ))}
      </div>
      <TextField label={value.kind === 'firma' ? 'Nazwa firmy' : 'Imię i nazwisko'} value={value.name} onChange={(e) => set({ name: e.target.value })} />
      <TextField label="Adres" value={value.address} onChange={(e) => set({ address: e.target.value })} optional />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={value.kind === 'firma' ? 'NIP / KRS' : 'PESEL'} value={value.idNumber} onChange={(e) => set({ idNumber: e.target.value })} optional inputMode="numeric" />
        <TextField label="E-mail" type="email" value={value.email} onChange={(e) => set({ email: e.target.value })} optional />
      </div>
      {value.kind === 'firma' && <TextField label="Osoba reprezentująca" value={value.representative} onChange={(e) => set({ representative: e.target.value })} optional />}
    </div>
  )
}

/**
 * Potwierdzenie danych użytkownika jako strony umowy (np. rozpoznanych z wklejonego tekstu)
 * z opcją zapisania ich w profilu do kolejnych umów i pism.
 */
export function OwnDataModal({
  open,
  initial,
  role,
  alreadySaved,
  onConfirm,
  onClose,
}: {
  open: boolean
  initial: SavedParty
  role?: string
  alreadySaved: boolean
  onConfirm: (data: SavedParty, save: boolean) => void
  onClose: () => void
}) {
  const [data, setData] = useState(initial)
  const [save, setSave] = useState(true)
  useEffect(() => {
    if (open) {
      setData(initial)
      setSave(true)
    }
  }, [open, initial])
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Czy to Twoje dane?"
      description={`Rozpoznaliśmy Twoje dane${role ? ` jako strony „${role}”` : ''}. Sprawdź je i popraw, jeśli trzeba.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Pomiń
          </Button>
          <Button variant="accent" disabled={!data.name.trim()} onClick={() => onConfirm({ ...data, name: data.name.trim() }, save)} icon={<BookmarkCheck className="size-4" />}>
            Potwierdź dane
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <PartyFields value={data} onChange={setData} />
        <Toggle checked={save} onChange={setSave} label={alreadySaved ? 'Zaktualizuj moje dane w Prawo.ai' : 'Zapisz jako moje dane w Prawo.ai'} hint="Będziemy ich używać automatycznie przy tworzeniu kolejnych umów i pism." />
      </div>
    </Modal>
  )
}
