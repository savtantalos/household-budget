import { useState } from 'react'
import { useAuth } from '../AuthContext'

export function AuthPanel() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, register, error, clearError } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      if (isRegister) {
        await register(email, password)
      } else {
        await login(email, password)
      }
    } catch {
      // error is set in context
    }
  }

  return (
    <div className="card" style={{ maxWidth: 360, margin: '4rem auto' }}>
      <h2>{isRegister ? 'Create account' : 'Sign in'}</h2>
      <p className="muted">
        {isRegister
          ? 'Create an account to start tracking your household budget.'
          : 'Sign in to view and edit your household budget.'}
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        {error && (
          <div className="card error" style={{ marginTop: '1rem' }}>
            <p>{error}</p>
          </div>
        )}
        <div className="form-row" style={{ marginTop: '1rem' }}>
          <button type="submit" className="primary">
            {isRegister ? 'Create account' : 'Sign in'}
          </button>
        </div>
      </form>

      <p className="muted" style={{ marginTop: '1rem' }}>
        {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          type="button"
          className="link"
          onClick={() => {
            setIsRegister(!isRegister)
            clearError()
          }}
        >
          {isRegister ? 'Sign in' : 'Create one'}
        </button>
      </p>
    </div>
  )
}
