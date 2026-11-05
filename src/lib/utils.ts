import type { Contract, PartyId } from '../types'

export function uid(prefix = 'id'): string {
  const rnd = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}${rnd}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

const dateFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return dateFmt.format(d)
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return dateTimeFmt.format(d)
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'przed chwilą'
  if (min < 60) return `${min} min temu`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} godz. temu`
  const d = Math.round(h / 24)
  if (d === 1) return 'wczoraj'
  if (d < 7) return `${d} dni temu`
  return formatDate(iso)
}

export function formatMoney(value: string | number | undefined): string {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n === 0) return '…'
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 }).format(n)
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function otherParty(id: PartyId): PartyId {
  return id === 'A' ? 'B' : 'A'
}

export type DisplayStatus = 'draft' | 'awaiting' | 'negotiation' | 'sent' | 'agreed' | 'signed'

export const STATUS_META: Record<DisplayStatus, { label: string; tone: string; dot: string }> = {
  draft: { label: 'Szkic', tone: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400' },
  sent: { label: 'Wysłana do wglądu', tone: 'bg-sky-50 text-sky-800 ring-sky-200', dot: 'bg-sky-500' },
  awaiting: { label: 'Wymaga Twojej odpowiedzi', tone: 'bg-amber-50 text-amber-900 ring-amber-200', dot: 'bg-amber-500' },
  negotiation: { label: 'W negocjacjach', tone: 'bg-violet-50 text-violet-800 ring-violet-200', dot: 'bg-violet-500' },
  agreed: { label: 'Uzgodniona', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500' },
  signed: { label: 'Podpisana', tone: 'bg-teal-700 text-white ring-teal-700', dot: 'bg-white' },
}

/** Status widziany przez daną stronę. */
export function displayStatus(c: Contract, viewer: PartyId): DisplayStatus {
  if (c.stage === 'signed') return 'signed'
  if (c.stage === 'agreed') return 'agreed'
  if (c.stage === 'draft') return 'draft'
  const open = c.proposals.filter((p) => p.status === 'open')
  if (open.some((p) => p.authorPartyId !== viewer)) return 'awaiting'
  const other = otherParty(viewer)
  const lastOtherComment = [...c.comments].reverse().find((cm) => cm.authorPartyId === other)
  const lastMine = [...c.comments].reverse().find((cm) => cm.authorPartyId === viewer)
  if (lastOtherComment && (!lastMine || lastOtherComment.createdAt > lastMine.createdAt)) return 'awaiting'
  const currentVersion = c.versions.length
  const otherAccepted = c.acceptedBy[other]?.version === currentVersion
  const meAccepted = c.acceptedBy[viewer]?.version === currentVersion
  if (otherAccepted && !meAccepted && open.length === 0) return 'awaiting'
  if (c.proposals.length === 0 && c.comments.length === 0 && !meAccepted) return 'sent'
  return 'negotiation'
}

export function lastActivity(c: Contract): string {
  return c.activity.length ? c.activity[c.activity.length - 1].at : c.updatedAt
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  )
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Prosty diff słów do podglądu zmian (LCS). */
export function diffWords(a: string, b: string): { type: 'same' | 'add' | 'del'; text: string }[] {
  const A = a.split(/(\s+)/)
  const B = b.split(/(\s+)/)
  if (A.length * B.length > 250000) {
    return [
      { type: 'del', text: a },
      { type: 'add', text: b },
    ]
  }
  const dp: number[][] = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0))
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: { type: 'same' | 'add' | 'del'; text: string }[] = []
  const push = (type: 'same' | 'add' | 'del', text: string) => {
    const last = out[out.length - 1]
    if (last && last.type === type) last.text += text
    else out.push({ type, text })
  }
  let i = 0
  let j = 0
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) {
      push('same', A[i])
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('del', A[i++])
    } else {
      push('add', B[j++])
    }
  }
  while (i < A.length) push('del', A[i++])
  while (j < B.length) push('add', B[j++])
  return out
}

export async function sha256(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    // Fallback (np. kontekst bez HTTPS) – prosty, niekryptograficzny skrót.
    let h = 0
    for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0
    return `fnv-${(h >>> 0).toString(16)}`
  }
}

/** Polska odmiana liczebnika: 1 umowa, 2 umowy, 5 umów. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one
  const d = n % 10
  const dd = n % 100
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many
}
