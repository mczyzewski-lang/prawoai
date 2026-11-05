import type { Contract } from '../types'
import { clausesToText } from './contractGenerator'
import { formatDateTime, sha256 } from './utils'

/**
 * Generowanie PDF w przeglądarce: strony są rysowane na canvasie (pełna obsługa
 * polskich znaków i podpisów odręcznych), a następnie składane w PDF przez jsPDF.
 * Wynikowy plik zawiera obrazy stron – w produkcji warto generować PDF/A z warstwą
 * tekstową po stronie serwera.
 */

const PT_W = 595.28
const PT_H = 841.89
const SCALE = 2.4
const M = 56

type Op =
  | { kind: 'text'; text: string; font: string; size: number; color: string; x: number; align?: 'left' | 'center'; lh: number }
  | { kind: 'space'; h: number }
  | { kind: 'sig'; h: number; parties: { role: string; name: string; signer?: string; at?: string; img?: HTMLImageElement; method?: string }[] }
  | { kind: 'rule'; h: number }

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function documentHash(c: Contract): Promise<string> {
  return sha256(clausesToText(c.title, c.clauses))
}

export async function downloadContractPdf(c: Contract): Promise<void> {
  const [{ jsPDF }] = await Promise.all([import('jspdf'), document.fonts?.ready])
  const serif = '"Source Serif 4 Variable", Georgia, "Times New Roman", serif'
  const sans = '"Inter Variable", system-ui, sans-serif'
  try {
    await Promise.all([document.fonts.load(`600 12px ${serif}`), document.fonts.load(`400 12px ${serif}`), document.fonts.load(`400 12px ${sans}`)])
  } catch {
    /* fonty systemowe jako zapas */
  }
  const hash = await documentHash(c)
  const version = c.versions.length

  const measure = document.createElement('canvas').getContext('2d')!
  const maxW = PT_W - 2 * M
  const ops: Op[] = []

  const wrap = (text: string, font: string): string[] => {
    measure.font = font
    const out: string[] = []
    for (const para of text.split('\n')) {
      const words = para.split(/\s+/).filter(Boolean)
      if (!words.length) {
        out.push('')
        continue
      }
      let line = ''
      for (const w of words) {
        const test = line ? `${line} ${w}` : w
        if (measure.measureText(test).width > maxW && line) {
          out.push(line)
          line = w
        } else line = test
      }
      if (line) out.push(line)
    }
    return out
  }
  const para = (text: string, opts: { size: number; weight?: number; family?: string; color?: string; align?: 'left' | 'center'; lh?: number }) => {
    const font = `${opts.weight ?? 400} ${opts.size}px ${opts.family ?? serif}`
    for (const line of wrap(text, font)) {
      ops.push({ kind: 'text', text: line, font, size: opts.size, color: opts.color ?? '#111827', x: M, align: opts.align, lh: opts.size * (opts.lh ?? 1.45) })
    }
  }

  para(c.title.toUpperCase(), { size: 16, weight: 650, align: 'center', lh: 1.3 })
  ops.push({ kind: 'space', h: 4 })
  para(`Wersja ${version} · ${c.stage === 'signed' ? 'dokument podpisany' : c.stage === 'agreed' ? 'wersja uzgodniona' : 'projekt'} · wygenerowano ${formatDateTime(new Date().toISOString())}`, {
    size: 8.5,
    family: sans,
    color: '#64748b',
    align: 'center',
  })
  ops.push({ kind: 'space', h: 18 })

  c.clauses.forEach((cl, i) => {
    para(`§ ${i + 1}. ${cl.title}`, { size: 11.5, weight: 650, lh: 1.35 })
    ops.push({ kind: 'space', h: 3 })
    para(cl.text, { size: 10.5 })
    ops.push({ kind: 'space', h: 12 })
  })

  ops.push({ kind: 'rule', h: 18 })
  para('Podpisy stron', { size: 11.5, weight: 650 })
  ops.push({ kind: 'space', h: 6 })
  const sigParties = await Promise.all(
    c.parties.map(async (p) => {
      const s = c.signatures.find((x) => x.partyId === p.id)
      return { role: p.role, name: p.name, signer: s?.signerName, at: s?.signedAt, method: s?.method, img: s ? await loadImage(s.dataUrl).catch(() => undefined) : undefined }
    }),
  )
  ops.push({ kind: 'sig', h: 132, parties: sigParties })
  ops.push({ kind: 'space', h: 10 })
  para('Podpisy złożone odręcznie na ekranie urządzenia w serwisie Prawo.ai. Dokument zawiera skrót treści pozwalający sprawdzić, czy treść umowy nie została zmieniona po podpisaniu.', {
    size: 8,
    family: sans,
    color: '#64748b',
  })

  // Paginacja
  const pages: Op[][] = [[]]
  let y = M
  const bottom = PT_H - M - 18
  for (const op of ops) {
    const h = op.kind === 'text' ? op.lh : op.h
    if (y + h > bottom && op.kind !== 'space') {
      pages.push([])
      y = M
    }
    pages[pages.length - 1].push(op)
    y += h
  }

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  pdf.setProperties({ title: c.title, subject: 'Umowa', creator: 'Prawo.ai' })

  pages.forEach((pageOps, pi) => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(PT_W * SCALE)
    canvas.height = Math.round(PT_H * SCALE)
    const ctx = canvas.getContext('2d')!
    ctx.scale(SCALE, SCALE)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, PT_W, PT_H)
    ctx.textBaseline = 'alphabetic'
    let yy = M
    for (const op of pageOps) {
      if (op.kind === 'text') {
        ctx.font = op.font
        ctx.fillStyle = op.color
        const w = ctx.measureText(op.text).width
        ctx.fillText(op.text, op.align === 'center' ? (PT_W - w) / 2 : op.x, yy + op.size)
        yy += op.lh
      } else if (op.kind === 'space') {
        yy += op.h
      } else if (op.kind === 'rule') {
        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(M, yy + op.h / 2)
        ctx.lineTo(PT_W - M, yy + op.h / 2)
        ctx.stroke()
        yy += op.h
      } else if (op.kind === 'sig') {
        const colW = (PT_W - 2 * M - 24) / 2
        op.parties.forEach((p, i) => {
          const x = M + i * (colW + 24)
          ctx.fillStyle = '#64748b'
          ctx.font = `600 8.5px ${sans}`
          ctx.fillText(p.role.toUpperCase(), x, yy + 10)
          ctx.fillStyle = '#111827'
          ctx.font = `400 10px ${serif}`
          ctx.fillText(p.name.slice(0, 48), x, yy + 24)
          const boxY = yy + 32
          const boxH = 64
          if (p.img) {
            const ratio = Math.min(colW / p.img.width, boxH / p.img.height)
            ctx.drawImage(p.img, x, boxY, p.img.width * ratio, p.img.height * ratio)
          } else {
            ctx.fillStyle = '#94a3b8'
            ctx.font = `italic 400 9px ${serif}`
            ctx.fillText('— brak podpisu —', x, boxY + boxH / 2)
          }
          ctx.strokeStyle = '#94a3b8'
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(x, boxY + boxH + 4)
          ctx.lineTo(x + colW, boxY + boxH + 4)
          ctx.stroke()
          if (p.at) {
            ctx.fillStyle = '#475569'
            ctx.font = `400 8px ${sans}`
            ctx.fillText(`${p.signer} · ${formatDateTime(p.at)}`, x, boxY + boxH + 16)
            ctx.fillText(p.method === 'typed' ? 'podpis wpisany na ekranie' : 'podpis odręczny na ekranie', x, boxY + boxH + 27)
          }
        })
        yy += op.h
      }
    }
    ctx.fillStyle = '#94a3b8'
    ctx.font = `400 7.5px ${sans}`
    ctx.fillText(`Prawo.ai · ${c.title.slice(0, 60)} · SHA-256: ${hash.slice(0, 24)}…`, M, PT_H - 30)
    const pageLabel = `Strona ${pi + 1} z ${pages.length}`
    ctx.fillText(pageLabel, PT_W - M - ctx.measureText(pageLabel).width, PT_H - 30)

    if (pi > 0) pdf.addPage()
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, PT_W, PT_H, undefined, 'FAST')
  })

  const safe = c.title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
  pdf.save(`${safe || 'umowa'}${c.stage === 'signed' ? '-podpisana' : ''}.pdf`)
}
