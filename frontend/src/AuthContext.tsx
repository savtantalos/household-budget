import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api } from './api'
import type { AuthToken, User } from './types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = 'budget-token'

function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const handleToken = useCallback((token: AuthToken) => {
    setStoredToken(token.access_token)
  }, [])

  const loadUser = useCallback(async () => {
    const token = getStoredToken()
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const me = await api.me()
      setUser(me)
    } catch {
      setStoredToken(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUser()
  }, [loadUser])

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null)
      try {
        const token = await api.login(email, password)
        handleToken(token)
        const me = await api.me()
        setUser(me)
      } catch (err) {
        setUser(null)
        setError(err instanceof Error ? err.message : 'Login failed')
        throw err
      }
    },
    [handleToken]
  )

  const register = useCallback(
    async (email: string, password: string) => {
      setError(null)
      try {
        const token = await api.register(email, password)
        handleToken(token)
        const me = await api.me()
        setUser(me)
      } catch (err) {
        setUser(null)
        setError(err instanceof Error ? err.message : 'Registration failed')
        throw err
      }
    },
    [handleToken]
  )

  const logout = useCallback(() => {
    setStoredToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, error, clearError }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
