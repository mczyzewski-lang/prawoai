import type { SavedParty } from '../types'

const FIRM = /\b(sp\.?\s*z\s*o\.?\s*o\.?|spółk\p{L}*|s\.\s?a\.|s\.\s?c\.|sp\.\s?j\.|sp\.\s?k\.|p\.?s\.?a\.?|fundacj\p{L}*|stowarzyszeni\p{L}*|P\.?P\.?H\.?U?\.?|F\.?H\.?U\.?|firm\p{L}*)/iu
const STREET = /\b(ul\.?|ulica|ulicy|al\.?|alej[a-z]*|aleja|os\.?|osiedle|pl\.?|plac|rynek)\s+([\p{L}][\p{L}\d .'-]*?)\s+(\d+[a-zA-Z]?(?:\s*[/]\s*\d+[a-zA-Z]?)?(?:\s*(?:m\.|lok\.|lokal)\s*\d+[a-zA-Z]?)?)/iu
const POSTAL = /(?<!\d)(\d{2})\s?[-–]\s?(\d{3})(?!\d)(?:\s*,?\s*([\p{Lu}][\p{L}-]+(?:\s[\p{Lu}][\p{L}-]+)?))?/u

/**
 * Odczytuje dane strony z dowolnie wpisanego tekstu, np.
 * „wprowadź dane klienta na Anna Kowalczyk Ul. Gminna 12 33-422 Nowa Wieś, PESEL 85010112345”.
 * Zwraca null, gdy nie da się wskazać nazwy.
 */
export function parseFreeParty(input: string): SavedParty | null {
  let t = ' ' + input.replace(/\s+/g, ' ').trim() + ' '
  // polecenie na początku: „wprowadź dane klienta na …”, „Dane drugiej strony: …”
  t = t
    .replace(/^\s*(?:prosz\p{L}*\s+)?(?:wprowad\p{L}*|wpisz|dodaj|uzupełn\p{L}*|zmie\p{L}*|ustaw|podmie\p{L}*|wstaw)\b.*?(?:\b(?:na|to)\b|:)\s*/iu, ' ')
    .replace(/^\s*(?:dane\s+)?(?:klienta|klient|kontrahenta|drugiej\s+strony|zleceniobiorcy|zleceniodawcy|wykonawcy|zamawiającego|najemcy|wynajmującego|kupującego|sprzedającego)\s*(?:to|:|-|–)?\s*/iu, ' ')
    .replace(/^\s*dane\s*(?::|-|–)\s*/iu, ' ')

  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = t.match(re)
    if (m) t = t.replace(m[0], ' ')
    return m
  }
  const email = take(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0]
  const nip = take(/\bNIP\s*:?\s*((?:\d[\s-]?){9}\d)\b/i)?.[1]?.replace(/[\s-]/g, '') ?? take(/(?<!\d)(\d{3}-\d{3}-\d{2}-\d{2}|\d{3}-\d{2}-\d{2}-\d{3})(?!\d)/)?.[1]?.replace(/-/g, '')
  const krs = take(/\bKRS\s*:?\s*(\d{10})\b/i)?.[1]
  take(/\bREGON\s*:?\s*\d{9,14}\b/i)
  const pesel = take(/\b(?:PESEL\s*:?\s*)?(\d{11})\b/i)?.[1]
  const rep = take(/reprezentowan\p{L}*\s+przez\s*:?\s*([\p{Lu}][\p{L}-]+(?:\s[\p{Lu}][\p{L}-]+){1,2})/iu)?.[1]

  const street = t.match(STREET)
  const postal = t.match(POSTAL)
  const firstAddr = Math.min(...[street?.index, postal?.index].filter((x): x is number => x !== undefined), t.length)

  // nazwa: tekst przed adresem (albo przed pierwszym przecinkiem)
  let name = t.slice(0, firstAddr).split(/,|;|\s+zam\.|\s+zamieszkał\p{L}*|\s+z\s+siedzibą|\s+adres\b/iu)[0]
  name = name
    .replace(/^\s*(?:Pan(?:i|em|ią)?|P\.)\s+/i, ' ')
    .replace(/[\s:,-]+$/g, '')
    .trim()
  if (name.length < 3 || /[?!]/.test(name)) return null
  // nazwa wygląda jak imię i nazwisko / nazwa firmy: krótka, słowa głównie wielką literą
  const words = name.replace(FIRM, ' ').split(/\s+/).filter((w) => w.length > 1)
  const caps = words.filter((w) => /^[\p{Lu}\d„"]/u.test(w)).length
  if (!words.length || words.length > 6 || caps < Math.ceil(words.length * 0.6)) return null

  let city = postal?.[3]?.trim() ?? ''
  if (!city && street && postal && postal.index !== undefined && street.index !== undefined && postal.index < street.index) {
    // „33-422 Nowa Wieś, ul. …” – miasto mogło zostać rozpoznane jako część ulicy
    city = ''
  }
  // miasto między ulicą a kodem: „ul. Gminna 12 Nowa Wieś 33-422”
  if (!city && street && postal && street.index !== undefined && postal.index !== undefined && postal.index > street.index) {
    const between = t.slice(street.index + street[0].length, postal.index).replace(/[\s,]+/g, ' ').trim()
    if (/^[\p{Lu}][\p{L}-]+(?:\s[\p{Lu}][\p{L}-]+)?$/u.test(between)) city = between
  }
  const streetText = street ? `${normPrefix(street[1])} ${street[2].trim()} ${street[3].replace(/\s+/g, '')}` : ''
  const town = postal ? [`${postal[1]}-${postal[2]}`, city].filter(Boolean).join(' ') : ''
  const address = [streetText, town].filter(Boolean).join(', ')

  const firm = FIRM.test(name) || (!!nip && !pesel) || !!krs
  return {
    kind: firm ? 'firma' : 'osoba',
    name: name.slice(0, 120),
    address,
    idNumber: firm ? (nip ?? krs ?? '') : (pesel ?? nip ?? ''),
    email: email ?? '',
    representative: firm ? (rep ?? '') : '',
  }
}

function normPrefix(p: string): string {
  const x = p.toLowerCase().replace(/\.$/, '')
  if (x.startsWith('ul')) return 'ul.'
  if (x.startsWith('al')) return 'al.'
  if (x.startsWith('os')) return 'os.'
  if (x === 'pl' || x === 'plac') return 'pl.'
  return p
}

/** Czy w tekście są dane adresowe/identyfikacyjne albo wyraźna prośba o wpisanie danych. */
export function looksLikePartyData(text: string): boolean {
  return POSTAL.test(text) || STREET.test(text) || /\b(PESEL|NIP|KRS)\b|@[\w-]+\.[a-z]/i.test(text) || /\b(dane|wprowad\p{L}*|wpisz|uzupełn\p{L}*)\b/iu.test(text)
}
