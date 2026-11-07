import { useEffect, useState } from 'react'
import type { Contract } from '../types'
import { allDeadlines, dueReminders, relativeLabel, type DeadlineRef } from './deadlines'

const SHOWN_KEY = 'prawoai:reminders-shown'

function loadShown(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SHOWN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
function saveShown(s: Set<string>) {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...s].slice(-500)))
  } catch {
    /* brak miejsca – przypomnienie pokaże się ponownie */
  }
}

export function notificationsState(): NotificationPermission | 'unsupported' {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
}

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export interface ActiveReminder {
  key: string
  ref: DeadlineRef
  days: number
}

/**
 * Przypomnienia o terminach: sprawdzane przy starcie i co 30 minut.
 * Pokazuje baner w aplikacji i – jeśli użytkownik pozwolił – powiadomienie przeglądarki.
 */
export function useReminders(contracts: Contract[]) {
  const [active, setActive] = useState<ActiveReminder[]>([])
  useEffect(() => {
    const check = () => {
      const shown = loadShown()
      const due = dueReminders(allDeadlines(contracts), shown)
      if (!due.length) return
      setActive((cur) => {
        const keys = new Set(cur.map((x) => x.key))
        return [...cur, ...due.filter((x) => !keys.has(x.key))]
      })
      if (notificationsState() === 'granted') {
        for (const r of due) {
          try {
            new Notification(`Termin: ${r.ref.d.title}`, { body: `${r.ref.c.title} · ${relativeLabel(r.ref.d.date)}`, tag: r.key })
          } catch {
            /* np. iOS bez PWA */
          }
        }
      }
      for (const r of due) shown.add(r.key)
      saveShown(shown)
    }
    check()
    const t = setInterval(check, 30 * 60_000)
    return () => clearInterval(t)
  }, [contracts])
  return { active, dismiss: (key?: string) => setActive((cur) => (key ? cur.filter((x) => x.key !== key) : [])) }
}
