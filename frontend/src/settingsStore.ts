import type { Settings } from './types'

interface Snapshot {
  settings: Settings | null
  status: 'loading' | 'saving' | 'saved' | 'error'
  error: string | null
}

export function createSettingsStore(
  read: () => Promise<Settings>,
  write: (patch: Partial<Settings>) => Promise<Settings>,
) {
  let snapshot: Snapshot = { settings: null, status: 'loading', error: null }
  let pending: Partial<Settings> = {}
  let loading: Promise<void> | null = null
  let saving = false
  const listeners = new Set<() => void>()

  const publish = (changes: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...changes }
    listeners.forEach((listener) => listener())
  }

  const load = (): Promise<void> => {
    if (snapshot.settings) return Promise.resolve()
    if (loading) return loading
    publish({ status: 'loading', error: null })
    loading = read()
      .then((settings) => publish({ settings, status: 'saved' }))
      .catch((error: unknown) => publish({
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not load chart settings.',
      }))
      .finally(() => { loading = null })
    return loading
  }

  const flush = async () => {
    if (saving || !snapshot.settings) return
    saving = true
    publish({ status: 'saving', error: null })
    try {
      while (Object.keys(pending).length > 0) {
        const patch = pending
        pending = {}
        try {
          await write(patch)
        } catch (error) {
          pending = { ...patch, ...pending }
          throw error
        }
      }
      publish({ status: 'saved' })
    } catch (error) {
      publish({
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not save chart settings.',
      })
    } finally {
      saving = false
    }
  }

  const update = (patch: Partial<Settings>) => {
    const current = snapshot.settings
    if (!current) return
    const changes = Object.fromEntries(
      Object.entries(patch).filter(([key, value]) => current[key as keyof Settings] !== value),
    ) as Partial<Settings>
    if (Object.keys(changes).length === 0) return
    pending = { ...pending, ...changes }
    publish({ settings: { ...current, ...changes } })
    void flush()
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    load,
    update,
    retry: () => snapshot.settings ? flush() : load(),
  }
}
