/**
 * Znak Prawo.ai – „Linia podpisu”: litera P z iskrą AI i odręcznym zawijasem jak podpis pod umową.
 * Ścieżki ikony w układzie 32×32 – wspólne dla logo (SVG), favicony i PDF (canvas).
 */
export const BRAND_PATHS = {
  /** Litera P (reguła evenodd – z wyciętym brzuszkiem). */
  letter: 'M8 5.5h8.2a6 6 0 0 1 0 12h-3.9v3.7H8zM12.3 9.3v4.4h3.6a2.2 2.2 0 0 0 0-4.4z',
  /** Iskra AI. */
  spark: 'M24.2 11.2c.45 2.75 2.25 4.55 5 5-2.75.45-4.55 2.25-5 5-.45-2.75-2.25-4.55-5-5 2.75-.45 4.55-2.25 5-5z',
  /** Zawijas podpisu (obrys, nie wypełnienie). */
  swash: 'M7 26.2c3.2-1.9 5.6.5 8.6-.3 3-.8 5.4-2.4 9.4-.8',
}

/** Elementy napisu „Prawo✦ai” (iskra 20×20, zawijas 120×16). */
export const WORDMARK_PATHS = {
  spark: 'M10 0c.7 5.2 4.8 9.3 10 10-5.2.7-9.3 4.8-10 10-.7-5.2-4.8-9.3-10-10 5.2-.7 9.3-4.8 10-10z',
  swash: 'M2 10c18-6 30 4 44 0 12-3.5 16-8 22-6 6 2-2 9 6 9 10 0 26-7 44-6',
}

export const BRAND_COLORS = { ink: '#0b2a33', teal: '#2fb8a5', tealDark: '#14a090', tealLight: '#5ed4c1', paper: '#ffffff' }
