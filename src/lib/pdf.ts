import type { Contract, Party } from '../types'
import { clausesToText } from './contractGenerator'
import { BRAND_COLORS, BRAND_PATHS } from './brand'
import { formatDate, formatDateTime, sha256 } from './utils'
import { documentKind, isPartiesClause, partiesClauseIsGenerated, partyRows, splitClauseLines, stageLabel } from './documentFormat'

/**
 * Generowanie PDF w przeglądarce: strony są rysowane na canvasie (pełna obsługa
 * polskich znaków i podpisów odręcznych), a następnie składane w PDF przez jsPDF.
 * Układ odpowiada widokowi dokumentu w aplikacji (strony w kolumnach, § z ustępami).
 * Wynikowy plik zawiera obrazy stron – w produkcji warto generować PDF/A z warstwą
 * tekstową po stronie serwera.
 */

const PT_W = 595.28
const PT_H = 841.89
const SCALE = 2.4
const M = 54
const CONTENT_W = PT_W - 2 * M

const C = {
  ink: '#0b2a33',
  text: '#1f2937',
  muted: '#64748b',
  faint: '#94a3b8',
  brand: '#0f7c70',
  brandLight: '#5ed4c1',
  brandBg: '#effcf9',
  line: '#e2e8f0',
  paper: '#ffffff',
}

const SERIF = '"Source Serif 4 Variable", Georgia, "Times New Roman", serif'
const SANS = '"Inter Variable", system-ui, sans-serif'

type Draw = (ctx: CanvasRenderingContext2D, y: number) => void
interface Op {
  h: number
  draw: Draw
  /** Odstęp – może przejść na koniec strony bez łamania. */
  space?: boolean
  /** Nie zaczynaj strony od tego elementu bez następnego (np. nagłówek §). */
  keepWithNext?: boolean
}

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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const k = s / 32
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(k, k)
  ctx.fillStyle = BRAND_COLORS.ink
  roundRect(ctx, 0, 0, 32, 32, 9)
  ctx.fill()
  ctx.fillStyle = BRAND_COLORS.paper
  ctx.fill(new Path2D(BRAND_PATHS.page))
  ctx.fillStyle = BRAND_COLORS.tealLight
  ctx.fill(new Path2D(BRAND_PATHS.fold))
  ctx.fillStyle = 'rgba(11,42,51,0.35)'
  ctx.fill(new Path2D(BRAND_PATHS.line1))
  ctx.fill(new Path2D(BRAND_PATHS.line2))
  const spark = new Path2D(BRAND_PATHS.spark)
  ctx.lineWidth = 2.2
  ctx.lineJoin = 'round'
  ctx.strokeStyle = BRAND_COLORS.ink
  ctx.stroke(spark)
  ctx.fillStyle = BRAND_COLORS.teal
  ctx.fill(spark)
  ctx.restore()
}

export async function downloadContractPdf(c: Contract): Promise<void> {
  const [{ jsPDF }] = await Promise.all([import('jspdf'), document.fonts?.ready])
  try {
    await Promise.all([document.fonts.load(`600 12px ${SERIF}`), document.fonts.load(`italic 400 12px ${SERIF}`), document.fonts.load(`400 12px ${SERIF}`), document.fonts.load(`600 12px ${SANS}`)])
  } catch {
    /* fonty systemowe jako zapas */
  }
  const hash = await documentHash(c)
  const version = c.versions.length
  const measure = document.createElement('canvas').getContext('2d')!

  const wrap = (text: string, font: string, width: number): string[] => {
    measure.font = font
    const out: string[] = []
    for (const para of text.split('\n')) {
      const words = para.split(/\s+/).filter(Boolean)
      if (!words.length) continue
      let line = ''
      for (const w of words) {
        const test = line ? `${line} ${w}` : w
        if (measure.measureText(test).width > width && line) {
          out.push(line)
          line = w
        } else line = test
      }
      if (line) out.push(line)
    }
    return out
  }

  const ops: Op[] = []
  const space = (h: number) => ops.push({ h, space: true, draw: () => {} })
  const textBlock = (text: string, o: { size: number; weight?: number; family?: string; color?: string; align?: 'left' | 'center'; lh?: number; italic?: boolean; x?: number; width?: number; tracking?: number }) => {
    const font = `${o.italic ? 'italic ' : ''}${o.weight ?? 400} ${o.size}px ${o.family ?? SERIF}`
    const x = o.x ?? M
    const width = o.width ?? CONTENT_W
    for (const line of wrap(text, font, width)) {
      const lh = o.size * (o.lh ?? 1.5)
      ops.push({
        h: lh,
        draw: (ctx, y) => {
          ctx.font = font
          ctx.fillStyle = o.color ?? C.text
          if (o.tracking) (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${o.tracking}px`
          const w = ctx.measureText(line).width
          ctx.fillText(line, o.align === 'center' ? (PT_W - w) / 2 : x, y + o.size)
          if (o.tracking) (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px'
        },
      })
    }
  }

  // ——— Nagłówek dokumentu ———
  const date = c.versions[version - 1]?.createdAt ?? c.createdAt
  ops.push({
    h: 30,
    draw: (ctx, y) => {
      drawMark(ctx, M, y, 16)
      ctx.font = `600 10px ${SANS}`
      ctx.fillStyle = C.ink
      ctx.fillText('Prawo.ai', M + 22, y + 11.5)
      ctx.font = `500 7.5px ${SANS}`
      ctx.fillStyle = C.muted
      const r = `WERSJA ${version} · ${formatDate(date).toUpperCase()}`
      ctx.fillText(r, PT_W - M - ctx.measureText(r).width, y + 11)
      ctx.strokeStyle = C.line
      ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.moveTo(M, y + 24)
      ctx.lineTo(PT_W - M, y + 24)
      ctx.stroke()
    },
  })
  space(26)
  textBlock(stageLabel(c).toUpperCase(), { size: 7.5, weight: 600, family: SANS, color: C.brand, align: 'center', tracking: 2 })
  space(4)
  textBlock(c.title, { size: 21, weight: 600, align: 'center', lh: 1.25, color: C.ink })
  const kind = documentKind(c)
  if (kind.toLowerCase() !== c.title.toLowerCase()) textBlock(kind, { size: 11, italic: true, align: 'center', color: C.muted })
  ops.push({
    h: 24,
    draw: (ctx, y) => {
      const cx = PT_W / 2
      ctx.strokeStyle = C.brandLight
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(cx - 34, y + 12)
      ctx.lineTo(cx - 6, y + 12)
      ctx.moveTo(cx + 6, y + 12)
      ctx.lineTo(cx + 34, y + 12)
      ctx.stroke()
      ctx.fillStyle = C.brand
      ctx.save()
      ctx.translate(cx, y + 12)
      ctx.rotate(Math.PI / 4)
      ctx.fillRect(-2.2, -2.2, 4.4, 4.4)
      ctx.restore()
    },
  })
  space(10)

  // ——— Strony w dwóch kolumnach ———
  const partiesOp = (parties: Party[]): Op => {
    const gap = 14
    const colW = (CONTENT_W - gap) / 2
    const pad = 12
    const inner = colW - 2 * pad
    const nameFont = `600 12.5px ${SERIF}`
    const valFont = `400 9px ${SANS}`
    const cols = parties.map((p, i) => {
      const name = wrap(p.name || '—', nameFont, inner)
      const rows = partyRows(p).map((r) => ({ label: r.label, lines: wrap(r.value, valFont, inner - 70) }))
      const h = pad + 10 + 6 + name.length * 16 + 6 + rows.reduce((a, r) => a + Math.max(1, r.lines.length) * 12 + 3, 0) + 16 + pad
      return { p, i, name, rows, h }
    })
    const h = Math.max(...cols.map((x) => x.h))
    return {
      h: h + 4,
      draw: (ctx, y) => {
        cols.forEach((col) => {
          const x = M + col.i * (colW + gap)
          ctx.fillStyle = '#fbfaf7'
          ctx.strokeStyle = C.line
          ctx.lineWidth = 0.8
          roundRect(ctx, x, y, colW, h, 8)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = C.brand
          ctx.fillRect(x, y + 10, 2, 20)
          let yy = y + pad
          ctx.font = `600 7px ${SANS}`
          ctx.fillStyle = C.brand
          ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '1.2px'
          ctx.fillText(`STRONA ${col.i + 1} · ${col.p.role.toUpperCase()}`, x + pad, yy + 7)
          ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px'
          yy += 10 + 6
          ctx.font = nameFont
          ctx.fillStyle = C.ink
          col.name.forEach((l) => {
            ctx.fillText(l, x + pad, yy + 12)
            yy += 16
          })
          yy += 6
          col.rows.forEach((r) => {
            ctx.font = `400 7.5px ${SANS}`
            ctx.fillStyle = C.muted
            ctx.fillText(r.label, x + pad, yy + 8)
            ctx.font = valFont
            ctx.fillStyle = C.text
            r.lines.forEach((l, li) => ctx.fillText(l, x + pad + 70, yy + 8 + li * 12))
            yy += Math.max(1, r.lines.length) * 12 + 3
          })
          ctx.font = `italic 400 8.5px ${SERIF}`
          ctx.fillStyle = C.muted
          ctx.fillText(`zwana/y dalej „${col.p.role}”`, x + pad, y + h - pad)
        })
        // „oraz” pośrodku
        const cx = PT_W / 2
        const cy = y + h / 2
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = C.line
        ctx.beginPath()
        ctx.arc(cx, cy, 11, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.font = `italic 400 7.5px ${SERIF}`
        ctx.fillStyle = C.brand
        const t = 'oraz'
        ctx.fillText(t, cx - ctx.measureText(t).width / 2, cy + 2.5)
      },
    }
  }

  // ——— Paragrafy ———
  const bodyFont = `400 10.5px ${SERIF}`
  const bodyLh = 15.5
  const clauseBody = (text: string, size = 10.5) => {
    const font = size === 10.5 ? bodyFont : `400 ${size}px ${SERIF}`
    const lh = size === 10.5 ? bodyLh : size * 1.45
    for (const l of splitClauseLines(text)) {
      if (l.kind === 'blank') {
        space(4)
        continue
      }
      const indent = l.kind === 'num' ? 20 : l.kind === 'para' ? 0 : 36
      const lines = wrap(l.content, font, CONTENT_W - indent)
      lines.forEach((line, li) => {
        ops.push({
          h: lh,
          draw: (ctx, y) => {
            if (li === 0 && l.marker) {
              ctx.font = l.kind === 'num' ? `600 ${size}px ${SERIF}` : font
              ctx.fillStyle = l.kind === 'num' ? C.brand : C.muted
              const mx = l.kind === 'num' ? M + 14 : M + 30
              ctx.fillText(l.marker, mx - ctx.measureText(l.marker).width, y + size)
            }
            ctx.font = font
            ctx.fillStyle = C.text
            ctx.fillText(line, M + indent, y + size)
          },
        })
      })
      space(3)
    }
  }

  c.clauses.forEach((cl, i) => {
    space(i === 0 ? 4 : 12)
    const label = `§ ${i + 1}`
    ops.push({
      h: 20,
      keepWithNext: true,
      draw: (ctx, y) => {
        ctx.font = `600 9px ${SERIF}`
        const w = ctx.measureText(label).width + 10
        ctx.fillStyle = C.brandBg
        roundRect(ctx, M, y + 2, w, 15, 3)
        ctx.fill()
        ctx.fillStyle = C.brand
        ctx.fillText(label, M + 5, y + 13)
        ctx.font = `600 12px ${SERIF}`
        ctx.fillStyle = C.ink
        ctx.fillText(cl.title, M + w + 8, y + 14)
      },
    })
    space(6)
    if (isPartiesClause(c, i)) {
      ops.push(partiesOp(c.parties))
      space(6)
      textBlock('zwanymi dalej łącznie „Stronami”', { size: 9.5, italic: true, align: 'center', color: C.muted })
      if (!partiesClauseIsGenerated(c, cl)) {
        space(6)
        clauseBody(cl.text, 9)
      }
    } else clauseBody(cl.text)
  })

  // ——— Podpisy ———
  space(22)
  const sigParties = await Promise.all(
    c.parties.map(async (p) => {
      const s = c.signatures.find((x) => x.partyId === p.id)
      return { p, s, img: s ? await loadImage(s.dataUrl).catch(() => undefined) : undefined }
    }),
  )
  ops.push({
    h: 150,
    draw: (ctx, y) => {
      ctx.font = `600 7.5px ${SANS}`
      ctx.fillStyle = C.muted
      ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '2px'
      const t = 'PODPISY STRON'
      ctx.fillText(t, (PT_W - ctx.measureText(t).width) / 2, y + 8)
      ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px'
      const colW = (CONTENT_W - 40) / 2
      sigParties.forEach(({ p, s, img }, i) => {
        const x = M + i * (colW + 40)
        const lineY = y + 92
        if (img) {
          const ratio = Math.min(colW / img.width, 62 / img.height)
          const w = img.width * ratio
          ctx.drawImage(img, x + (colW - w) / 2, lineY - 4 - img.height * ratio, w, img.height * ratio)
        } else {
          ctx.font = `italic 400 9px ${SERIF}`
          ctx.fillStyle = '#cbd5e1'
          const ph = 'miejsce na podpis'
          ctx.fillText(ph, x + (colW - ctx.measureText(ph).width) / 2, lineY - 8)
        }
        ctx.strokeStyle = C.faint
        ctx.lineWidth = 0.7
        ctx.beginPath()
        ctx.moveTo(x, lineY)
        ctx.lineTo(x + colW, lineY)
        ctx.stroke()
        const center = (txt: string, font: string, color: string, yy: number) => {
          ctx.font = font
          ctx.fillStyle = color
          ctx.fillText(txt, x + (colW - ctx.measureText(txt).width) / 2, yy)
        }
        center(p.role.toUpperCase(), `600 7.5px ${SANS}`, C.brand, lineY + 13)
        center(p.name.slice(0, 50), `400 10px ${SERIF}`, C.ink, lineY + 26)
        if (s) {
          center(`${s.signerName} · ${formatDateTime(s.signedAt)}`, `400 7.5px ${SANS}`, C.muted, lineY + 38)
          center(s.method === 'sms' ? `podpis potwierdzony kodem SMS ${s.phone ?? ''}` : s.method === 'typed' ? 'podpis wpisany na ekranie' : 'podpis odręczny na ekranie', `400 7px ${SANS}`, C.faint, lineY + 48)
        }
      })
    },
  })
  if (c.signatures.length) {
    space(6)
    textBlock('Podpisy złożone na ekranie urządzenia w serwisie Prawo.ai. Dokument zawiera skrót treści (SHA-256), który pozwala sprawdzić, czy treść umowy nie została zmieniona po podpisaniu.', {
      size: 7.5,
      family: SANS,
      color: C.muted,
      align: 'center',
    })
  }

  // ——— Paginacja ———
  const pages: Op[][] = [[]]
  let y = M
  const bottom = PT_H - M - 14
  ops.forEach((op, i) => {
    let need = op.h
    if (op.keepWithNext) {
      // nagłówek § razem z pierwszą linią treści
      const next = ops.slice(i + 1).find((o) => !o.space)
      need += (next?.h ?? 0) + 6
    }
    if (y + need > bottom && !op.space && pages[pages.length - 1].length) {
      pages.push([])
      y = M
    }
    if (op.space && y === M && pages[pages.length - 1].length === 0) return
    pages[pages.length - 1].push(op)
    y += op.h
  })

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  pdf.setProperties({ title: c.title, subject: documentKind(c), creator: 'Prawo.ai' })

  pages.forEach((pageOps, pi) => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(PT_W * SCALE)
    canvas.height = Math.round(PT_H * SCALE)
    const ctx = canvas.getContext('2d')!
    ctx.scale(SCALE, SCALE)
    ctx.fillStyle = C.paper
    ctx.fillRect(0, 0, PT_W, PT_H)
    // pasek marki u góry
    const grad = ctx.createLinearGradient(0, 0, PT_W, 0)
    grad.addColorStop(0, '#169b8a')
    grad.addColorStop(0.5, '#5ed4c1')
    grad.addColorStop(1, '#12404c')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, PT_W, 3)
    ctx.textBaseline = 'alphabetic'
    let yy = M
    for (const op of pageOps) {
      op.draw(ctx, yy)
      yy += op.h
    }
    // stopka
    ctx.strokeStyle = C.line
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(M, PT_H - 40)
    ctx.lineTo(PT_W - M, PT_H - 40)
    ctx.stroke()
    drawMark(ctx, M, PT_H - 33, 8)
    ctx.font = `400 7px ${SANS}`
    ctx.fillStyle = C.faint
    ctx.fillText(`Prawo.ai · ${c.title.slice(0, 55)} · SHA-256: ${hash.slice(0, 20)}…`, M + 12, PT_H - 27)
    const pageLabel = `Strona ${pi + 1} z ${pages.length}`
    ctx.fillText(pageLabel, PT_W - M - ctx.measureText(pageLabel).width, PT_H - 27)

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
