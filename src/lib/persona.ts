import type { GrammarForm, Profile } from '../types'

/**
 * Personalizacja komunikatów: zwracanie się po imieniu i formy gramatyczne.
 * Formę wybiera użytkownik (profil) – nie zgadujemy jej z imienia.
 */

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
  return { addressAs: p.addressAs?.trim() || '', form: p.form ?? 'n' }
}

/** „Katarzyno, rozumiem…” – dopisuje zwrot do początku wiadomości. */
export function greet(text: string, addressAs: string): string {
  if (!addressAs) return text
  return `${addressAs}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`
}

export const FORM_LABEL: Record<GrammarForm, string> = { f: 'forma żeńska (np. „otrzymałaś”)', m: 'forma męska (np. „otrzymałeś”)', n: 'forma neutralna' }
