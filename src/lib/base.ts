/** Aplikacja (panel) działa pod /demoav; strona główna to waitlista. */
export const APP_BASE = '/demoav'

/** Pełny adres w aplikacji (do linków wysyłanych e-mailem/SMS-em i kopiowania). */
export function appUrl(path: string): string {
  return `${window.location.origin}${APP_BASE}${path.startsWith('/') ? path : `/${path}`}`
}
