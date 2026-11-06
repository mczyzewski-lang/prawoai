import type { DataCollection, DataRow, SavedParty } from '../types'
import { joinAddress } from './documentFormat'
import { uid } from './utils'

/** Stałe kolumny kolekcji osób i firm. */
export const PERSON_COLUMNS = [
  { id: 'kind', label: 'Rodzaj' },
  { id: 'name', label: 'Imię i nazwisko / nazwa firmy' },
  { id: 'street', label: 'Ulica i numer' },
  { id: 'postal', label: 'Kod pocztowy' },
  { id: 'city', label: 'Miejscowość' },
  { id: 'idNumber', label: 'NIP / PESEL' },
  { id: 'email', label: 'E-mail' },
  { id: 'representative', label: 'Osoba reprezentująca' },
]

export function defaultDataBook(): DataCollection[] {
  return [
    {
      id: 'osoby',
      name: 'Osoby i firmy',
      kind: 'osoby',
      columns: PERSON_COLUMNS,
      rows: [
        { id: uid('dr'), label: 'Jan Kowalski', values: { kind: 'osoba', name: 'Jan Kowalski', street: 'ul. Lipowa 4/2', postal: '60-101', city: 'Poznań', idNumber: '', email: 'jan.kowalski@example.com', representative: '' } },
      ],
    },
    {
      id: 'sprzet',
      name: 'Sprzęt i produkty',
      kind: 'inne',
      columns: [
        { id: 'fullName', label: 'Pełna nazwa' },
        { id: 'producer', label: 'Producent' },
        { id: 'model', label: 'Model / kod' },
        { id: 'warranty', label: 'Gwarancja' },
        { id: 'price', label: 'Cena katalogowa' },
      ],
      rows: [
        { id: uid('dr'), label: 'Pompa 12kW', values: { fullName: 'Pompa ciepła powietrze–woda 12 kW', producer: 'Panasonic', model: 'WH-MDC12H6E5', warranty: '5 lat gwarancji producenta', price: '' } },
      ],
    },
  ]
}

/** Dane strony umowy z wiersza kolekcji osób. */
export function rowToParty(r: DataRow): SavedParty {
  const v = r.values
  return {
    kind: v.kind === 'firma' ? 'firma' : 'osoba',
    name: (v.name || r.label).trim(),
    address: joinAddress({ street: v.street ?? '', postal: v.postal ?? '', city: v.city ?? '' }),
    idNumber: v.idNumber ?? '',
    email: v.email ?? '',
    representative: v.representative ?? '',
  }
}

/** Opis wiersza do podpowiedzi i do przekazania modelowi („Model / kod: WH-…; Gwarancja: 5 lat”). */
export function rowDetails(c: DataCollection, r: DataRow): { label: string; value: string }[] {
  return c.columns.map((col) => ({ label: col.label, value: (r.values[col.id] ?? '').trim() })).filter((x) => x.value)
}
