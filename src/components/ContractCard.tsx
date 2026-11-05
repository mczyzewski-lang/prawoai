import { Link } from 'react-router-dom'
import { ChevronRight, FileText, Users } from 'lucide-react'
import type { Contract } from '../types'
import { displayStatus, formatRelative, lastActivity, otherParty } from '../lib/utils'
import { StatusBadge } from './ui'

export function ContractRow({ c }: { c: Contract }) {
  const status = displayStatus(c, c.ownerPartyId)
  const other = c.parties.find((p) => p.id === otherParty(c.ownerPartyId))!
  const lastAct = c.activity[c.activity.length - 1]
  return (
    <li>
      <Link
        to={`/umowy/${c.id}`}
        className="group flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200/80 transition hover:ring-brand-300 hover:shadow-md sm:gap-4"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sand-100 text-ink-800" aria-hidden>
          <FileText className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="truncate font-semibold text-ink-900 group-hover:text-brand-700">{c.title}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-slate-600">
            <Users className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{other.name || other.role}</span>
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusBadge status={status} />
            <span className="text-xs text-slate-500">
              {formatRelative(lastActivity(c))}
              {lastAct ? <span className="hidden sm:inline"> · {lastAct.text}</span> : null}
            </span>
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden />
      </Link>
    </li>
  )
}
