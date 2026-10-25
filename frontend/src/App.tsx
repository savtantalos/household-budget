import { useEffect, useState, useSyncExternalStore } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import { api } from './api'
import './App.css'
import { AuthPanel } from './components/AuthPanel'
import { ChatPanel } from './components/ChatPanel'
import { Dashboard } from './components/Dashboard'
import { ExpensesPanel } from './components/ExpensesPanel'
import { IncomePanel } from './components/IncomePanel'
import { ColoursPanel } from './components/ColoursPanel'
import { InvestmentsPanel } from './components/InvestmentsPanel'
import { MortgagePanel } from './components/MortgagePanel'
import { PeoplePanel } from './components/PeoplePanel'
import { SavingsPanel } from './components/SavingsPanel'
import { createSettingsStore } from './settingsStore'
import { useBudget } from './useBudget'

const TABS = [
  'Dashboard',
  'People',
  'Income',
  'Expenses',
  'Savings',
  'Investments',
  'Mortgage',
  'Colours',
  'Chat',
] as const
type Tab = (typeof TABS)[number]

function BudgetApp() {
  const { data, error, loading, refresh } = useBudget()
  const { user, logout } = useAuth()
  const [tab, setTab] = useState<Tab>('Dashboard')
  const [settingsStore] = useState(() => createSettingsStore(api.settings, api.updateSettings))
  const { settings, status, error: settingsError } = useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.getSnapshot,
  )
  const unsaved = settings !== null && (status === 'saving' || status === 'error')

  useEffect(() => {
    void settingsStore.load()
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const current = settingsStore.getSnapshot()
      if (current.settings && (current.status === 'saving' || current.status === 'error')) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [settingsStore])

  return (
    <div className="app">
      <header>
        <div>
          <h1>Household Budget</h1>
          <p className="muted">Shared costs, settlements and savings for the two of you.</p>
        </div>
        <nav>
          {TABS.map((option) => (
            <button
              key={option}
              className={option === tab ? 'tab active' : 'tab'}
              onClick={() => setTab(option)}
            >
              {option}
            </button>
          ))}
        </nav>
        <div className="user-bar">
          <span className="muted">{user?.email}</span>
          <button type="button" className="secondary" onClick={logout} disabled={unsaved}>
            Log out
          </button>
        </div>
      </header>

      {loading && <p className="muted">Loading…</p>}
      {error && (
        <div className="card error">
          <strong>Could not reach the API.</strong>
          <p>{error}</p>
        </div>
      )}
      {status === 'loading' && <p className="muted">Loading chart settings…</p>}
      {status === 'saving' && <p className="muted" role="status">Saving chart settings…</p>}
      {status === 'saved' && <p className="muted" role="status">Chart settings saved.</p>}
      {settingsError && (
        <div className="card error" role="alert">
          <strong>{settings ? 'Chart changes have not been saved.' : 'Could not load chart settings.'}</strong>
          <p>{settingsError}</p>
          <button type="button" onClick={() => void settingsStore.retry()}>Retry</button>
        </div>
      )}

      {data && (
        <main>
          {tab === 'Dashboard' && (
            <Dashboard summary={data.summary} expenses={data.expenses} onChange={refresh} />
          )}
          {tab === 'People' && <PeoplePanel people={data.people} onChange={refresh} />}
          {tab === 'Income' && (
            <IncomePanel
              incomes={data.incomes}
              transfers={data.transfers}
              people={data.people}
              onChange={refresh}
            />
          )}
          {tab === 'Expenses' && (
            <ExpensesPanel
              expenses={data.expenses}
              people={data.people}
              categories={data.categories}
              onChange={refresh}
            />
          )}
          {tab === 'Savings' && settings && (
            <SavingsPanel
              savingsPlans={data.savingsPlans}
              accounts={data.accounts}
              people={data.people}
              onChange={refresh}
              settings={settings}
              onSettingsChange={settingsStore.update}
            />
          )}
          {tab === 'Investments' && settings && (
            <InvestmentsPanel
              investments={data.investments}
              people={data.people}
              onChange={refresh}
              settings={settings}
              onSettingsChange={settingsStore.update}
            />
          )}
          {tab === 'Mortgage' && settings && (
            <MortgagePanel settings={settings} onSettingsChange={settingsStore.update} />
          )}
          {tab === 'Colours' && settings && (
            <ColoursPanel
              investments={data.investments}
              savingsPlans={data.savingsPlans}
              accounts={data.accounts}
              settings={settings}
              onSettingsChange={settingsStore.update}
            />
          )}
          {tab === 'Chat' && <ChatPanel />}
        </main>
      )}
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return <p className="muted">Checking session…</p>
  }

  return user ? <BudgetApp key={user.id} /> : <AuthPanel />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
