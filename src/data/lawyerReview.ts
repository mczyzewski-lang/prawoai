/**
 * Płatna weryfikacja umowy przez prawnika PRAVNA.pl – pakiety i ustawienia.
 * Ceny są propozycją do zatwierdzenia przez PRAVNA.pl (netto, PLN).
 */

export interface ReviewPackage {
  id: string
  name: string
  priceNet: number
  /** Do ilu stron (≈ 350 słów na stronę). */
  maxPages: number
  includes: string[]
  /** Czas realizacji w dniach roboczych. */
  days: number
}

export const REVIEW_PACKAGES: ReviewPackage[] = [
  {
    id: 'uwagi',
    name: 'Sprawdzenie uwag AI',
    priceNet: 149,
    maxPages: 10,
    days: 1,
    includes: ['Prawnik potwierdza lub poprawia uwagi AI', 'Odpowiedź na Twoje pytania do umowy', 'Krótka rekomendacja: podpisać / negocjować / nie podpisywać'],
  },
  {
    id: 'pelna',
    name: 'Pełna weryfikacja umowy',
    priceNet: 490,
    maxPages: 25,
    days: 1,
    includes: ['Poprawki wprowadzone w treści umowy', 'Komentarze prawnika przy zapisach', 'Jedna runda zmian po Twoich uwagach', 'Znak „Zweryfikowane przez prawnika” w dokumencie i PDF'],
  },
  {
    id: 'negocjacje',
    name: 'Weryfikacja + negocjacje',
    priceNet: 990,
    maxPages: 25,
    days: 2,
    includes: ['Wszystko z pełnej weryfikacji', 'Prawnik prowadzi rundę negocjacji z drugą stroną w Prawo.ai', 'Podsumowanie uzgodnień przed podpisem'],
  },
]

/** Dopłata za tryb ekspresowy (wynik w 4 godziny robocze). */
export const EXPRESS_MULTIPLIER = 1.5
export const VAT = 0.23

/**
 * Adres, na który trafiają zamówienia (do czasu podłączenia płatności i panelu prawnika).
 * Puste = tryb demonstracyjny: zamówienie zapisuje się tylko w aplikacji.
 */
export const REVIEW_ORDER_EMAIL = ''

export const REVIEWER_NAME = 'radca prawny / adwokat PRAVNA.pl'
