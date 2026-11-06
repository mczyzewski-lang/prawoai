import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Contract, Conversation, DataCollection, GuestAccount, MyTemplate, Profile } from '../types'
import { defaultDataBook } from '../lib/dataBook'
import { DEFAULT_PROFILE, seedContracts, seedConversations } from './seed'

const STORAGE_KEY = 'prawoai:v1'
const SCHEMA_VERSION = 1

export interface AppState {
  schema: number
  profile: Profile
  contracts: Contract[]
  conversations: Conversation[]
  /** Konta gości (kontrahentów) per link udostępnienia. */
  guestAccounts: Record<string, GuestAccount>
  /** Własne wzory użytkownika. */
  myTemplates: MyTemplate[]
  /** „Adresy i dane” – osoby, sprzęt i inne dane wstawiane do umów przez „@”. */
  dataBook: DataCollection[]
}

function freshState(): AppState {
  return { schema: SCHEMA_VERSION, profile: DEFAULT_PROFILE, contracts: seedContracts(), conversations: seedConversations(), guestAccounts: {}, myTemplates: [], dataBook: defaultDataBook() }
}

type LoadResult = { state: AppState; error: string | null }

function load(): LoadResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { state: freshState(), error: null }
    const parsed = JSON.parse(raw) as AppState
    if (parsed.schema !== SCHEMA_VERSION || !Array.isArray(parsed.contracts)) {
      return { state: freshState(), error: 'Zapisane dane pochodzą z innej wersji aplikacji, dlatego przywróciliśmy dane przykładowe.' }
    }
    return { state: { ...freshState(), ...parsed }, error: null }
  } catch {
    return { state: freshState(), error: 'Nie udało się odczytać zapisanych danych. Przywróciliśmy dane przykładowe.' }
  }
}

interface Store {
  state: AppState
  loadError: string | null
  saveError: string | null
  dismissLoadError: () => void
  getContract: (id: string) => Contract | undefined
  getByShareId: (shareId: string) => Contract | undefined
  upsertContract: (c: Contract) => void
  updateContract: (id: string, fn: (c: Contract) => Contract) => void
  deleteContract: (id: string) => void
  upsertConversation: (c: Conversation) => void
  updateConversation: (id: string, fn: (c: Conversation) => Conversation) => void
  deleteConversation: (id: string) => void
  setGuestAccount: (shareId: string, acc: GuestAccount | null) => void
  updateProfile: (p: Profile) => void
  upsertMyTemplate: (t: MyTemplate) => void
  deleteMyTemplate: (id: string) => void
  setDataBook: (fn: (d: DataCollection[]) => DataCollection[]) => void
  resetDemo: () => void
}

const Ctx = createContext<Store | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const initial = useRef<LoadResult | null>(null)
  if (!initial.current) initial.current = load()
  const [state, setState] = useState<AppState>(initial.current.state)
  const [loadError, setLoadError] = useState<string | null>(initial.current.error)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      setSaveError(null)
    } catch {
      setSaveError('Nie udało się zapisać zmian w pamięci przeglądarki (brak miejsca lub tryb prywatny).')
    }
  }, [state])

  // Synchronizacja między kartami (np. widok kontrahenta otwarty w nowej karcie).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        setState(JSON.parse(e.newValue) as AppState)
      } catch {
        /* ignoruj uszkodzone dane z innej karty */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const updateContract = useCallback((id: string, fn: (c: Contract) => Contract) => {
    setState((s) => ({ ...s, contracts: s.contracts.map((c) => (c.id === id ? fn(c) : c)) }))
  }, [])

  const updateConversation = useCallback((id: string, fn: (c: Conversation) => Conversation) => {
    setState((s) => ({ ...s, conversations: s.conversations.map((c) => (c.id === id ? fn(c) : c)) }))
  }, [])

  const store = useMemo<Store>(
    () => ({
      state,
      loadError,
      saveError,
      dismissLoadError: () => setLoadError(null),
      getContract: (id) => state.contracts.find((c) => c.id === id),
      getByShareId: (shareId) => state.contracts.find((c) => c.shareId === shareId),
      upsertContract: (c) =>
        setState((s) => ({
          ...s,
          contracts: s.contracts.some((x) => x.id === c.id) ? s.contracts.map((x) => (x.id === c.id ? c : x)) : [c, ...s.contracts],
        })),
      updateContract,
      deleteContract: (id) => setState((s) => ({ ...s, contracts: s.contracts.filter((c) => c.id !== id) })),
      upsertConversation: (c) =>
        setState((s) => ({
          ...s,
          conversations: s.conversations.some((x) => x.id === c.id) ? s.conversations.map((x) => (x.id === c.id ? c : x)) : [c, ...s.conversations],
        })),
      updateConversation,
      deleteConversation: (id) => setState((s) => ({ ...s, conversations: s.conversations.filter((c) => c.id !== id) })),
      setGuestAccount: (shareId, acc) =>
        setState((s) => {
          const guestAccounts = { ...s.guestAccounts }
          if (acc) guestAccounts[shareId] = acc
          else delete guestAccounts[shareId]
          return { ...s, guestAccounts }
        }),
      updateProfile: (profile) => setState((s) => ({ ...s, profile })),
      upsertMyTemplate: (t) => setState((s) => ({ ...s, myTemplates: [t, ...(s.myTemplates ?? []).filter((x) => x.id !== t.id)] })),
      setDataBook: (fn) => setState((s) => ({ ...s, dataBook: fn(s.dataBook ?? defaultDataBook()) })),
      deleteMyTemplate: (id) => setState((s) => ({ ...s, myTemplates: (s.myTemplates ?? []).filter((x) => x.id !== id) })),
      resetDemo: () => {
        setState(freshState())
        setLoadError(null)
      },
    }),
    [state, loadError, saveError, updateContract, updateConversation],
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used within AppStoreProvider')
  return s
}
