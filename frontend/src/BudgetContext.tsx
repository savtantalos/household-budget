import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { api } from './api'
import { createSettingsStore } from './settingsStore'
import { useTheme } from './ThemeContext'
import type { Settings } from './types'
import { useBudget, type BudgetData } from './useBudget'

type SettingsStore = ReturnType<typeof createSettingsStore>
type SettingsSnapshot = ReturnType<SettingsStore['getSnapshot']>

interface BudgetContextValue {
  data: BudgetData | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  settings: Settings | null
  settingsStatus: SettingsSnapshot['status']
  settingsError: string | null
  updateSettings: (patch: Partial<Settings>) => void
  retrySettings: () => Promise<void>
  /** True while a settings save is in flight or has failed and not yet been retried. */
  unsaved: boolean
}

const BudgetContext = createContext<BudgetContextValue | null>(null)

/**
 * Loads the household data and the per-user settings once for the signed-in user and
 * shares them with every routed page. Mount it with `key={user.id}` so a different
 * login gets a fresh store.
 */
export function BudgetProvider({ children }: { children: ReactNode }) {
  const budget = useBudget()
  const [store] = useState(() => createSettingsStore(api.settings, api.updateSettings))
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const { setTheme } = useTheme()

  const unsaved =
    snapshot.settings !== null && (snapshot.status === 'saving' || snapshot.status === 'error')

  useEffect(() => {
    void store.load()
  }, [store])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const current = store.getSnapshot()
      if (current.settings && (current.status === 'saving' || current.status === 'error')) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [store])

  // The backend setting is the source of truth for the theme; mirror it locally.
  const theme = snapshot.settings?.theme
  useEffect(() => {
    if (theme) setTheme(theme)
  }, [theme, setTheme])

  const value = useMemo<BudgetContextValue>(
    () => ({
      data: budget.data,
      loading: budget.loading,
      error: budget.error,
      refresh: budget.refresh,
      settings: snapshot.settings,
      settingsStatus: snapshot.status,
      settingsError: snapshot.error,
      updateSettings: store.update,
      retrySettings: store.retry,
      unsaved,
    }),
    [budget.data, budget.loading, budget.error, budget.refresh, snapshot, store, unsaved],
  )

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
}

export function useBudgetContext() {
  const context = useContext(BudgetContext)
  if (!context) throw new Error('useBudgetContext must be used within BudgetProvider')
  return context
}
