/**
 * Odczyt tekstu z plików w przeglądarce (bez wysyłania na serwer).
 * PDF – pdf.js (tylko PDF z warstwą tekstową; skany wymagają OCR po stronie backendu).
 * DOCX – mammoth.
 */

export const MAX_FILE_MB = 10

export class ExtractError extends Error {}

export async function extractText(file: File): Promise<string> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new ExtractError(`Plik jest za duży. Maksymalny rozmiar to ${MAX_FILE_MB} MB.`)
  }
  const name = file.name.toLowerCase()
  let text = ''
  try {
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      text = await readPdf(file)
    } else if (name.endsWith('.docx')) {
      text = await readDocx(file)
    } else if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) {
      text = await file.text()
    } else if (name.endsWith('.doc')) {
      throw new ExtractError('Starszy format .doc nie jest obsługiwany. Zapisz dokument jako .docx lub PDF.')
    } else {
      throw new ExtractError('Nieobsługiwany format pliku. Wgraj PDF, DOCX lub TXT.')
    }
  } catch (e) {
    if (e instanceof ExtractError) throw e
    throw new ExtractError('Nie udało się odczytać pliku. Sprawdź, czy nie jest uszkodzony lub zabezpieczony hasłem.')
  }
  const cleaned = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (cleaned.length < 40) {
    throw new ExtractError('Nie znaleźliśmy tekstu w tym pliku. Jeśli to skan, wklej treść umowy ręcznie.')
  }
  return cleaned
}

async function readPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: string[] = []
  for (let i = 1; i <= Math.min(doc.numPages, 60); i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let lastY: number | null = null
    let line = ''
    const lines: string[] = []
    for (const item of content.items as { str: string; transform: number[]; hasEOL?: boolean }[]) {
      const y = item.transform?.[5]
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 4) {
        lines.push(line)
        line = ''
      }
      line += item.str
      if (item.hasEOL) {
        lines.push(line)
        line = ''
      }
      lastY = y ?? lastY
    }
    if (line) lines.push(line)
    pages.push(lines.join('\n'))
  }
  return pages.join('\n\n')
}

async function readDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const lib = (mammoth as unknown as { default?: typeof mammoth }).default ?? mammoth
  const res = await lib.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return res.value
}
