import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api'
import { money, moneyCompact, moneyTooltip, percent } from '../format'
import type { Expense, SplitMode, Summary } from '../types'

const CATEGORY_COLOURS = [
  '#2f6fed',
  '#e0629b',
  '#28b487',
  '#f5a623',
  '#7c5cff',
  '#ff6b6b',
  '#00b8d9',
]

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'positive' | 'negative'
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone ?? ''}`}>{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  )
}

const SPLIT_MODES: { value: SplitMode; label: string; hint: string }[] = [
  {
    value: 'even',
    label: 'Split evenly',
    hint: 'Shared costs are halved, and the transfer squares up who paid more than their half.',
  },
  {
    value: 'difference',
    label: 'Pay the difference',
    hint: 'Whoever paid less into shared costs sends the other the full difference.',
  },
]

export function Dashboard({
  summary,
  expenses,
  onChange,
}: {
  summary: Summary
  expenses: Expense[]
  onChange: () => void
}) {
  const byCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount
      return acc
    }, {}),
  ).map(([name, value]) => ({ name, value }))

  const perPerson = summary.people.map((person) => ({
    name: person.name,
    Income: person.income,
    'True cost': person.true_cost,
    Savings: person.savings,
    Leftover: person.remaining_after_savings,
  }))

  return (
    <div className="stack">
      <section className="stat-grid">
        <Stat label="Monthly income" value={money(summary.total_income)} />
        <Stat label="Monthly expenses" value={money(summary.total_expenses)} />
        <Stat
          label="Cash balance"
          value={money(summary.cash_balance)}
          tone={summary.cash_balance >= 0 ? 'positive' : 'negative'}
          hint={`${percent(summary.spend_ratio)} of income spent`}
        />
        <Stat label="Monthly savings" value={money(summary.total_savings)} />
        <Stat label="Net worth tracked" value={money(summary.net_worth)} />
      </section>

      <section className="card">
        <h2>Who owes who this month</h2>
        {summary.settlements.length === 0 ? (
          <p className="muted">Everything is square — shared costs are already balanced.</p>
        ) : (
          <ul className="settlements">
            {summary.settlements.map((settlement) => (
              <li key={`${settlement.from_person}-${settlement.to_person}`}>
                <strong>{settlement.from_person}</strong> pays{' '}
                <strong>{settlement.to_person}</strong>
                <span className="amount">{money(settlement.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="split-mode">
          <span className="stat-label">Settle shared costs by</span>
          <div className="split-mode-options">
            {SPLIT_MODES.map((mode) => (
              <button
                key={mode.value}
                className={mode.value === summary.split_mode ? 'tab active' : 'tab'}
                onClick={() => void api.updateSettings(mode.value).then(onChange)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        <p className="muted">
          {SPLIT_MODES.find((mode) => mode.value === summary.split_mode)?.hint} Shared costs total{' '}
          {money(summary.shared_expenses)}; personal costs ({money(summary.personal_expenses)}) and
          person-to-person transfers are netted off.
        </p>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Spending by category</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={60} label>
                {byCategory.map((entry, index) => (
                  <Cell key={entry.name} fill={CATEGORY_COLOURS[index % CATEGORY_COLOURS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={moneyTooltip} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </section>

        <section className="card">
          <h2>Per person</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={perPerson}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f2" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={moneyCompact} width={70} />
              <Tooltip formatter={moneyTooltip} />
              <Legend />
              <Bar dataKey="Income" fill="#2f6fed" />
              <Bar dataKey="True cost" fill="#ff6b6b" />
              <Bar dataKey="Savings" fill="#28b487" />
              <Bar dataKey="Leftover" fill="#f5a623" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <section className="card">
        <h2>Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Income</th>
              <th>Paid into shared</th>
              <th>Fair share</th>
              <th>Personal</th>
              <th>Transfers</th>
              <th>Settlement</th>
              <th>Left after savings</th>
            </tr>
          </thead>
          <tbody>
            {summary.people.map((person) => (
              <tr key={person.id}>
                <td>{person.name}</td>
                <td>{money(person.income)}</td>
                <td>{money(person.paid_shared)}</td>
                <td>{money(person.fair_share)}</td>
                <td>{money(person.paid_personal)}</td>
                <td>
                  {money(person.transfers_in - person.transfers_out)}
                </td>
                <td className={person.settlement >= 0 ? 'positive' : 'negative'}>
                  {person.settlement >= 0
                    ? `receives ${money(person.settlement)}`
                    : `pays ${money(-person.settlement)}`}
                </td>
                <td>{money(person.remaining_after_savings)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
