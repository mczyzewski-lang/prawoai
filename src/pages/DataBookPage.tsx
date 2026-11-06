import { useState } from 'react'
import { AtSign, Building2, Columns3, Database, Package, Pencil, Plus, Trash2, User, UserCog, Users } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Button, EmptyState, Modal, PageHeader, TextField } from '../components/ui'
import { useToast } from '../components/Toast'
import { ProfileModal } from '../components/ProfileModal'
import { defaultDataBook, rowDetails, rowToParty } from '../lib/dataBook'
import { cx, uid } from '../lib/utils'
import type { DataCollection, DataColumn, DataRow } from '../types'

/** „Adresy i dane” – baza osób, firm, sprzętu i innych danych wstawianych do umów przez „@”. */
export default function DataBookPage() {
  const { state, setDataBook } = useStore()
  const toast = useToast()
  const book = state.dataBook ?? defaultDataBook()
  const [activeId, setActiveId] = useState(book[0]?.id ?? 'osoby')
  const col = book.find((c) => c.id === activeId) ?? book[0]
  const [editRow, setEditRow] = useState<DataRow | null>(null)
  const [deleteRow, setDeleteRow] = useState<DataRow | null>(null)
  const [colModal, setColModal] = useState<'new' | 'edit' | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)

  const updateCol = (id: string, fn: (c: DataCollection) => DataCollection) => setDataBook((d) => d.map((c) => (c.id === id ? fn(c) : c)))
  const saveRow = (r: DataRow) => {
    updateCol(col.id, (c) => ({ ...c, rows: c.rows.some((x) => x.id === r.id) ? c.rows.map((x) => (x.id === r.id ? r : x)) : [...c.rows, r] }))
    setEditRow(null)
    toast(`Zapisano „${r.label}” – wstawisz to w umowie, wpisując @${r.label}`)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Konto"
        title="Adresy i dane"
        description="Zapisz osoby, firmy, sprzęt i inne dane, które często wpisujesz do umów. W polu „Stwórz umowę” i w asystencie wstawisz je, wpisując @ i nazwę – np. „sprzedaż @Pompa 12kW dla @Jan Kowalski po cenie 12 900 zł”."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Kolekcje danych">
        {book.map((c) => {
          const Icon = c.kind === 'osoby' ? Users : c.id === 'sprzet' ? Package : Database
          const active = c.id === col.id
          return (
            <button
              key={c.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setActiveId(c.id)}
              className={cx('inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium ring-1 ring-inset transition', active ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-slate-700 ring-slate-300 hover:ring-slate-400')}
            >
              <Icon className="size-4" aria-hidden />
              {c.name}
              <span className={cx('rounded-full px-1.5 text-xs', active ? 'bg-white/20' : 'bg-slate-100 text-slate-600')}>{c.rows.length}</span>
            </button>
          )
        })}
        <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => setColModal('new')}>
          Nowa kolekcja
        </Button>
      </div>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5" aria-label={col.name}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-ink-900">{col.name}</h2>
            <p className="text-sm text-slate-500">
              {col.kind === 'osoby' ? 'Strony umów – dane uzupełnią się w kolumnach stron.' : `Kolumny: ${col.columns.map((x) => x.label).join(' · ') || 'brak'}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {col.kind === 'inne' && (
              <Button variant="secondary" size="sm" icon={<Columns3 className="size-4" />} onClick={() => setColModal('edit')}>
                Kolumny i nazwa
              </Button>
            )}
            <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => setEditRow({ id: uid('dr'), label: '', values: col.kind === 'osoby' ? { kind: 'osoba' } : {} })}>
              Dodaj
            </Button>
          </div>
        </div>

        {col.kind === 'osoby' && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-brand-50/60 px-4 py-3 ring-1 ring-brand-100">
            <UserCog className="size-5 shrink-0 text-brand-700" aria-hidden />
            <p className="min-w-0 flex-1 text-sm text-slate-700">
              <span className="font-semibold text-ink-900">Twoje dane do umów: </span>
              {state.profile.ownParty ? [state.profile.ownParty.name, state.profile.ownParty.address].filter(Boolean).join(', ') : 'jeszcze nie zapisano'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => setProfileOpen(true)}>
              {state.profile.ownParty ? 'Edytuj' : 'Uzupełnij'}
            </Button>
          </div>
        )}

        {col.rows.length === 0 ? (
          <EmptyState icon={col.kind === 'osoby' ? <Users className="size-6" /> : <Package className="size-6" />} title={col.kind === 'osoby' ? 'Brak zapisanych osób i firm' : 'Kolekcja jest pusta'} className="mt-4" action={<Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditRow({ id: uid('dr'), label: '', values: col.kind === 'osoby' ? { kind: 'osoba' } : {} })}>Dodaj pierwszą pozycję</Button>}>
            Dodane pozycje wstawisz do umowy, wpisując @ i ich nazwę.
          </EmptyState>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {col.rows.map((r) => {
              const details = col.kind === 'osoby' ? partyDetails(r) : rowDetails(col, r)
              return (
                <li key={r.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-sand-100 text-ink-700" aria-hidden>
                    {col.kind === 'osoby' ? r.values.kind === 'firma' ? <Building2 className="size-4" /> : <User className="size-4" /> : <Package className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink-900">{r.label}</span>
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] text-brand-800 ring-1 ring-inset ring-brand-100">
                        <AtSign className="size-3" aria-hidden />
                        {r.label}
                      </span>
                    </p>
                    {details.length > 0 ? (
                      <dl className="mt-1 grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        {details.map((d) => (
                          <div key={d.label} className="flex min-w-0 gap-1.5">
                            <dt className="shrink-0 text-slate-500">{d.label}:</dt>
                            <dd className="min-w-0 truncate text-slate-800" title={d.value}>
                              {d.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="mt-1 text-sm text-slate-400">brak szczegółów</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" aria-label={`Edytuj: ${r.label}`} icon={<Pencil className="size-4" />} onClick={() => setEditRow(r)} />
                    <Button variant="ghost" size="sm" aria-label={`Usuń: ${r.label}`} icon={<Trash2 className="size-4" />} onClick={() => setDeleteRow(r)} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {editRow && <RowModal col={col} row={editRow} onClose={() => setEditRow(null)} onSave={saveRow} taken={book.flatMap((c) => c.rows).filter((x) => x.id !== editRow.id).map((x) => x.label.trim().toLowerCase())} />}

      <Modal
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        title="Usunąć pozycję?"
        description={deleteRow ? `„${deleteRow.label}” zniknie z bazy. Umowy, do których już ją wpisano, zostaną bez zmian.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteRow(null)}>
              Anuluj
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteRow) updateCol(col.id, (c) => ({ ...c, rows: c.rows.filter((x) => x.id !== deleteRow.id) }))
                setDeleteRow(null)
              }}
            >
              Usuń
            </Button>
          </>
        }
      >
        <span />
      </Modal>

      {colModal && (
        <CollectionModal
          initial={colModal === 'edit' ? col : null}
          onClose={() => setColModal(null)}
          onDelete={
            colModal === 'edit' && col.kind === 'inne'
              ? () => {
                  setDataBook((d) => d.filter((c) => c.id !== col.id))
                  setActiveId(book[0].id)
                  setColModal(null)
                }
              : undefined
          }
          onSave={(c) => {
            if (colModal === 'new') {
              setDataBook((d) => [...d, c])
              setActiveId(c.id)
            } else updateCol(c.id, () => c)
            setColModal(null)
          }}
        />
      )}
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}

function partyDetails(r: DataRow): { label: string; value: string }[] {
  const p = rowToParty(r)
  return [
    { label: 'Nazwa', value: p.name },
    { label: 'Adres', value: p.address },
    { label: p.kind === 'firma' ? 'NIP / KRS' : 'PESEL', value: p.idNumber },
    { label: 'E-mail', value: p.email },
    { label: 'Reprezentacja', value: p.kind === 'firma' ? p.representative : '' },
  ].filter((x) => x.value)
}

function RowModal({ col, row, onClose, onSave, taken }: { col: DataCollection; row: DataRow; onClose: () => void; onSave: (r: DataRow) => void; taken: string[] }) {
  const [r, setR] = useState<DataRow>(row)
  const set = (k: string, v: string) => setR((x) => ({ ...x, values: { ...x.values, [k]: v } }))
  const isPerson = col.kind === 'osoby'
  const firm = r.values.kind === 'firma'
  const labelTaken = !!r.label.trim() && taken.includes(r.label.trim().toLowerCase())
  const label = r.label.trim() || (isPerson ? (r.values.name ?? '').trim() : '')
  return (
    <Modal
      open
      onClose={onClose}
      title={row.label ? `Edytuj: ${row.label}` : isPerson ? 'Nowa osoba lub firma' : `Nowa pozycja: ${col.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant="primary" disabled={!label || labelTaken} onClick={() => onSave({ ...r, label })}>
            Zapisz
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {isPerson && (
          <div role="radiogroup" aria-label="Rodzaj" className="flex w-fit rounded-xl bg-slate-100 p-1">
            {(['osoba', 'firma'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={(r.values.kind ?? 'osoba') === k} onClick={() => set('kind', k)} className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium', (r.values.kind ?? 'osoba') === k ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600')}>
                {k === 'osoba' ? <User className="size-3.5" aria-hidden /> : <Building2 className="size-3.5" aria-hidden />}
                {k === 'osoba' ? 'Osoba' : 'Firma'}
              </button>
            ))}
          </div>
        )}
        {isPerson && <TextField label={firm ? 'Nazwa firmy' : 'Imię i nazwisko'} value={r.values.name ?? ''} onChange={(e) => set('name', e.target.value)} />}
        <TextField
          label="Nazwa do wstawiania przez @"
          value={r.label}
          onChange={(e) => setR((x) => ({ ...x, label: e.target.value }))}
          placeholder={isPerson ? r.values.name || 'np. Klient Nowak' : 'np. Pompa 12kW'}
          hint={labelTaken ? undefined : isPerson ? 'Zostaw puste, aby użyć imienia i nazwiska / nazwy firmy.' : 'Krótka nazwa, którą wpiszesz po @.'}
          error={labelTaken ? 'Taka nazwa już istnieje w Twoich danych.' : undefined}
        />
        {isPerson ? (
          <>
            <TextField label="Ulica i numer" value={r.values.street ?? ''} onChange={(e) => set('street', e.target.value)} optional />
            <div className="grid grid-cols-[8rem_1fr] gap-3">
              <TextField
                label="Kod pocztowy"
                value={r.values.postal ?? ''}
                inputMode="numeric"
                placeholder="00-000"
                onChange={(e) => {
                  const d = e.target.value.replace(/[^\d]/g, '').slice(0, 5)
                  set('postal', d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d)
                }}
              />
              <TextField label="Miejscowość" value={r.values.city ?? ''} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label={firm ? 'NIP / KRS' : 'PESEL'} value={r.values.idNumber ?? ''} onChange={(e) => set('idNumber', e.target.value)} optional inputMode="numeric" />
              <TextField label="E-mail" type="email" value={r.values.email ?? ''} onChange={(e) => set('email', e.target.value)} optional />
            </div>
            {firm && <TextField label="Osoba reprezentująca" value={r.values.representative ?? ''} onChange={(e) => set('representative', e.target.value)} optional />}
          </>
        ) : col.columns.length ? (
          col.columns.map((c) => <TextField key={c.id} label={c.label} value={r.values[c.id] ?? ''} onChange={(e) => set(c.id, e.target.value)} optional />)
        ) : (
          <p className="text-sm text-slate-500">Ta kolekcja nie ma jeszcze kolumn – dodaj je przyciskiem „Kolumny i nazwa”.</p>
        )}
      </div>
    </Modal>
  )
}

function CollectionModal({ initial, onClose, onSave, onDelete }: { initial: DataCollection | null; onClose: () => void; onSave: (c: DataCollection) => void; onDelete?: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [cols, setCols] = useState<DataColumn[]>(initial?.columns ?? [{ id: uid('dc'), label: 'Pełna nazwa' }, { id: uid('dc'), label: '' }])
  const clean = cols.filter((c) => c.label.trim())
  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `Kolekcja: ${initial.name}` : 'Nowa kolekcja danych'}
      description="Np. „Usługi”, „Nieruchomości”, „Pojazdy” – z własnymi kolumnami, które będą wpisywane do umów."
      footer={
        <>
          {onDelete && (
            <Button variant="ghost" className="mr-auto text-red-700" icon={<Trash2 className="size-4" />} onClick={onDelete}>
              Usuń kolekcję
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant="primary" disabled={!name.trim()} onClick={() => onSave({ id: initial?.id ?? uid('dcol'), kind: 'inne', name: name.trim(), columns: clean.map((c) => ({ ...c, label: c.label.trim() })), rows: initial?.rows ?? [] })}>
            Zapisz
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextField label="Nazwa kolekcji" value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Usługi" />
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Kolumny</legend>
          <ul className="space-y-2">
            {cols.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2">
                <label htmlFor={`col-${c.id}`} className="sr-only">
                  Kolumna {i + 1}
                </label>
                <input id={`col-${c.id}`} value={c.label} onChange={(e) => setCols((x) => x.map((y) => (y.id === c.id ? { ...y, label: e.target.value } : y)))} placeholder={`Kolumna ${i + 1}, np. Gwarancja`} className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
                <Button variant="ghost" size="sm" aria-label="Usuń kolumnę" icon={<Trash2 className="size-4" />} onClick={() => setCols((x) => x.filter((y) => y.id !== c.id))} />
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" className="mt-2" icon={<Plus className="size-4" />} onClick={() => setCols((x) => [...x, { id: uid('dc'), label: '' }])}>
            Dodaj kolumnę
          </Button>
        </fieldset>
      </div>
    </Modal>
  )
}
