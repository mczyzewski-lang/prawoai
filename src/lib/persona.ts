import type { GrammarForm, Profile } from '../types'

/**
 * Personalizacja komunikatów: zwracanie się po imieniu i formy gramatyczne.
 * Formę można ustawić w profilu; domyślnie odczytujemy ją z typowo polskiego imienia,
 * a pytamy tylko, gdy imię jest niejednoznaczne.
 */

/** Męskie imiona zakończone na „-a” (wyjątki od reguły). */
const MALE_A = /^(kuba|barnaba|bonawentura|jarema|kosma|boryna|saba|juda|zawisza|sasza|misza|grisza|nikita|luca|andrea)$/i
/** Żeńskie imiona bez końcówki „-a”. */
const FEMALE_OTHER = /^(beatrycze|nicole|noemi|carmen|ingrid|miriam|ruth|abigail|dolores|rachel|karen|mercedes|agnes|alice|michelle|chloe|zoe|inez)$/i

/** Forma gramatyczna z imienia (undefined, gdy nie da się ocenić). */
export function guessForm(fullName: string): GrammarForm | undefined {
  const first = fullName.trim().split(/\s+/)[0]?.replace(/[^\p{L}]/gu, '') ?? ''
  if (first.length < 2) return undefined
  if (FEMALE_OTHER.test(first)) return 'f'
  if (/a$/i.test(first)) return MALE_A.test(first) ? 'm' : 'f'
  if (/^\p{Lu}\p{Ll}+$/u.test(first)) return 'm'
  return undefined
}

/** Propozycja wołacza do edycji przez użytkownika (heurystyka końcówek). */
export function suggestVocative(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? ''
  if (!first) return ''
  const rules: [RegExp, string][] = [
    [/ia$/, 'iu'],
    [/^(\p{Lu}\p{Ll})la$/u, '$1lu'],
    [/a$/, 'o'],
    [/ł$/, 'le'],
    [/sz$/, 'szu'],
    [/ek$/, 'ku'],
    [/tr$/, 'trze'],
    [/r$/, 'rze'],
    [/n$/, 'nie'],
    [/m$/, 'mie'],
    [/w$/, 'wie'],
    [/k$/, 'ku'],
    [/j$/, 'ju'],
    [/l$/, 'lu'],
  ]
  for (const [re, rep] of rules) if (re.test(first)) return first.replace(re, rep)
  return first
}

/** Zamienia zapisy typu „otrzymałeś(-aś)”, „Dostałem(-am)” na właściwą formę. */
export function adapt(text: string, form: GrammarForm | undefined): string {
  if (!form || form === 'n') return text
  return text
    .replace(/(\p{L}+)eś\(-aś\)/gu, (_m, b: string) => (form === 'f' ? `${b}aś` : `${b}eś`))
    .replace(/(\p{L}+)em\(-am\)/gu, (_m, b: string) => (form === 'f' ? `${b}am` : `${b}em`))
}

export function personaFor(p: Profile): { addressAs: string; form: GrammarForm } {
  const addressAs = p.addressAs === undefined ? suggestVocative(p.name) : p.addressAs.trim()
  return { addressAs, form: p.form ?? guessForm(p.name) ?? 'n' }
}

/** „Katarzyno, rozumiem…” – dopisuje zwrot do początku wiadomości. */
export function greet(text: string, addressAs: string): string {
  if (!addressAs) return text
  return `${addressAs}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`
}

export const FORM_LABEL: Record<GrammarForm, string> = { f: 'forma żeńska (np. „otrzymałaś”)', m: 'forma męska (np. „otrzymałeś”)', n: 'forma neutralna' }
