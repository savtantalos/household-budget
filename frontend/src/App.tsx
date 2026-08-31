import { useState } from 'react'
import './App.css'
import { Dashboard } from './components/Dashboard'
import { ExpensesPanel } from './components/ExpensesPanel'
import { IncomePanel } from './components/IncomePanel'
import { MortgagePanel } from './components/MortgagePanel'
import { SavingsPanel } from './components/SavingsPanel'
import { useBudget } from './useBudget'

const TABS = ['Dashboard', 'Income', 'Expenses', 'Savings', 'Mortgage'] as const
type Tab = (typeof TABS)[number]

export default function App() {
  const { data, error, loading, refresh } = useBudget()
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
      </header>

      {loading && <p className="muted">Loading…</p>}
      {error && (
        <div className="card error">
          <strong>Could not reach the API.</strong>
          <p>{error}</p>
          <p className="muted">Start the backend with `uvicorn app.main:app --reload`.</p>
        </div>
      )}

      {data && (
        <main>
          {tab === 'Dashboard' && (
            <Dashboard summary={data.summary} expenses={data.expenses} />
          )}
          {tab === 'Income' && (
            <IncomePanel
              incomes={data.incomes}
              transfers={data.transfers}
              people={data.people}
              onChange={refresh}
            />
          )}
          {tab === 'Expenses' && (
            <ExpensesPanel expenses={data.expenses} people={data.people} onChange={refresh} />
          )}
          {tab === 'Savings' && (
            <SavingsPanel
              savingsPlans={data.savingsPlans}
              accounts={data.accounts}
              people={data.people}
              onChange={refresh}
            />
          )}
          {tab === 'Mortgage' && <MortgagePanel />}
        </main>
      )}
    </div>
  )
}
