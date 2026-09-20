import { useState } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import './App.css'
import { AuthPanel } from './components/AuthPanel'
import { Dashboard } from './components/Dashboard'
import { ExpensesPanel } from './components/ExpensesPanel'
import { IncomePanel } from './components/IncomePanel'
import { ColoursPanel } from './components/ColoursPanel'
import { InvestmentsPanel } from './components/InvestmentsPanel'
import { MortgagePanel } from './components/MortgagePanel'
import { PeoplePanel } from './components/PeoplePanel'
import { SavingsPanel } from './components/SavingsPanel'
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
] as const
type Tab = (typeof TABS)[number]

function BudgetApp() {
  const { data, error, loading, refresh } = useBudget()
  const { user, logout } = useAuth()
  const [tab, setTab] = useState<Tab>('Dashboard')

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
          <button type="button" className="secondary" onClick={logout}>
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
          {tab === 'Savings' && (
            <SavingsPanel
              savingsPlans={data.savingsPlans}
              accounts={data.accounts}
              people={data.people}
              onChange={refresh}
            />
          )}
          {tab === 'Investments' && (
            <InvestmentsPanel
              investments={data.investments}
              people={data.people}
              onChange={refresh}
            />
          )}
          {tab === 'Mortgage' && <MortgagePanel />}
          {tab === 'Colours' && (
            <ColoursPanel
              investments={data.investments}
              savingsPlans={data.savingsPlans}
              accounts={data.accounts}
            />
          )}
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

  return user ? <BudgetApp /> : <AuthPanel />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
