import { useCallback, useEffect, useState } from 'react'
import type { AppState } from '../store/AppStore'
import { allDeadlines, daysUntil, fromYmd, relativeLabel, todayYmd } from './deadlines'

export type NotificationKind = 'umowa' | 'podpis' | 'sugestia' | 'komentarz' | 'zespół' | 'termin' | 'prawnik' | 'windykacja'

export interface AppNotification {
  id: string
  at: string
  kind: NotificationKind
  title: string
  text: string
  href: string
  tone: 'info' | 'success' | 'warning' | 'danger'
}

export const KIND_GROUP: Record<NotificationKind, 'Umowy' | 'Terminy' | 'Zespół'> = {
  umowa: 'Umowy',
  podpis: 'Umowy',
  sugestia: 'Umowy',
  komentarz: 'Umowy',
  zespół: 'Zespół',
  termin: 'Terminy',
  prawnik: 'Umowy',
  windykacja: 'Terminy',
}

function classify(text: string): { kind: NotificationKind; tone: AppNotification['tone'] } {
  const t = text.toLowerCase()
  if (/podpisał|podpis/.test(t)) return { kind: 'podpis', tone: 'success' }
  if (/uzgodnił|zaakceptował\(a\) wersj/.test(t)) return { kind: 'umowa', tone: 'success' }
  if (/zatwierdził|dołączył|udostępnił\(a\) umowę|odebrał/.test(t)) return { kind: 'zespół', tone: 'info' }
  if (/propozycj|sugesti|zmian/.test(t)) return { kind: 'sugestia', tone: 'warning' }
  if (/komentarz|skomentował/.test(t)) return { kind: 'komentarz', tone: 'info' }
  if (/weryfikacj|prawnik/.test(t)) return { kind: 'prawnik', tone: 'info' }
  return { kind: 'umowa', tone: 'info' }
}

/**
 * Powiadomienia wyliczane z danych: działania innych osób w umowach (udostępnienie, sugestie,
 * komentarze, akceptacje, podpisy, zatwierdzenia zespołu) oraz zbliżające się i minione terminy.
 */
export function buildNotifications(state: AppState): AppNotification[] {
  const me = state.profile.name.trim()
  const out: AppNotification[] = []
  for (const c of state.contracts) {
    for (const a of c.activity) {
      // własne działania pomijamy (wpis od Twojego imienia albo działanie Twojej strony bez autora)
      if (me && a.text.startsWith(me)) continue
      if (a.partyId === c.ownerPartyId && !a.internal) continue
      if (!a.partyId && !/uzgodnił|podpis/i.test(a.text)) continue
      const { kind, tone } = classify(a.text)
      out.push({ id: `a:${a.id}`, at: a.at, kind, tone, title: c.title, text: a.text, href: `/umowy/${c.id}` })
    }
  }
  const today = todayYmd()
  for (const { d, c } of allDeadlines(state.contracts)) {
    if (d.done || !d.date) continue
    const left = daysUntil(d.date, today)
    const lead = Math.max(0, ...d.remind)
    if (left > lead) continue
    // moment pojawienia się powiadomienia: najbliższy przekroczony próg przypomnienia
    const hit = [...d.remind, 0].sort((x, y) => x - y).find((n) => left <= n) ?? 0
    const trigger = fromYmd(d.date)
    if (left >= 0) trigger.setDate(trigger.getDate() - hit)
    trigger.setHours(left < 0 ? 9 : 8, 0, 0, 0)
    const at = new Date(Math.min(Date.now(), trigger.getTime())).toISOString()
    out.push({
      id: `d:${d.id}:${left < 0 ? 'po' : hit}`,
      at,
      kind: 'termin',
      tone: left < 0 ? 'danger' : left <= 1 ? 'warning' : 'info',
      title: left < 0 ? `Termin minął: ${d.title}` : `Termin ${relativeLabel(d.date)}: ${d.title}`,
      text: c.title,
      href: `/umowy/${c.id}?panel=terminy`,
    })
  }
  for (const dc of state.debtCases ?? []) {
    const last = dc.events[dc.events.length - 1]
    if (dc.status === 'nowa' && last) out.push({ id: `w:${dc.id}`, at: last.at, kind: 'windykacja', tone: 'warning', title: `Zaległa płatność: ${dc.debtor.name}`, text: 'Wybierz kolejny krok – przypomnienie lub wezwanie do zapłaty.', href: `/windykacja/${dc.id}` })
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

const SEEN_KEY = 'prawoai:notifications-seen'

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Stan przeczytania: wszystko sprzed ostatniego „oznacz jako przeczytane” jest przeczytane. */
export function useNotificationsSeen() {
  const [seen, setSeen] = useState(readSeen)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === SEEN_KEY && setSeen(e.newValue ?? '')
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  const markAll = useCallback(() => {
    const now = new Date().toISOString()
    try {
      localStorage.setItem(SEEN_KEY, now)
    } catch {
      /* tryb prywatny */
    }
    setSeen(now)
  }, [])
  return { seen, markAll, isUnread: (n: AppNotification) => !seen || n.at > seen }
}
