import type { Theme } from './types'

/**
 * The per-user `Setting.theme` is the source of truth. This key only caches the last
 * known value so the login screen and the first paint after a reload use the right
 * colours; it is overwritten from the backend as soon as settings load.
 */
export const THEME_CACHE_KEY = 'budget-theme'

export const THEMES: Theme[] = ['system', 'light', 'dark']

const isTheme = (value: unknown): value is Theme =>
  typeof value === 'string' && (THEMES as string[]).includes(value)

const darkQuery = () =>
  typeof window !== 'undefined' && 'matchMedia' in window
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

export function readCachedTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_CACHE_KEY)
    return isTheme(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function cacheTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme)
  } catch {
    // Storage may be unavailable (private mode); the backend value still applies.
  }
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return darkQuery()?.matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): 'light' | 'dark' {
  const resolved = resolveTheme(theme)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
  return resolved
}

/** Re-applies a `system` theme when the OS preference changes. */
export function watchSystemTheme(onChange: () => void): () => void {
  const query = darkQuery()
  if (!query) return () => {}
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
