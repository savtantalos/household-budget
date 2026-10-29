import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { applyTheme, cacheTheme, readCachedTheme, watchSystemTheme } from './theme'
import type { Theme } from './types'

interface ThemeContextValue {
  /** The user's preference: light, dark, or follow the OS. */
  theme: Theme
  /** What is actually on screen right now. */
  resolvedTheme: 'light' | 'dark'
  /** Applies a theme locally and caches it. Persisting to the backend is the caller's job. */
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readCachedTheme)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => applyTheme(theme))

  useEffect(() => {
    setResolvedTheme(applyTheme(theme))
    cacheTheme(theme)
    if (theme !== 'system') return
    return watchSystemTheme(() => setResolvedTheme(applyTheme('system')))
  }, [theme])

  const setTheme = useCallback((next: Theme) => setThemeState(next), [])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
