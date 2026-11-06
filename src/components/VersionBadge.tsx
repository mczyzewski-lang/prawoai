import { formatDateTime } from '../lib/utils'

/** Numer wersji w prawym dolnym rogu – do sprawdzenia, czy wdrożenie jest aktualne. */
export function VersionBadge() {
  const label = `v${__APP_VERSION__} · ${__BUILD_SHA__}`
  return (
    <div
      className="no-print fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-2 z-20 select-none rounded-md bg-white/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200 backdrop-blur md:bottom-2"
      title={`Zbudowano: ${formatDateTime(__BUILD_TIME__)}`}
      aria-label={`Wersja aplikacji ${label}, zbudowana ${formatDateTime(__BUILD_TIME__)}`}
    >
      {label}
    </div>
  )
}
