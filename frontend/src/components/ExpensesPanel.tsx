import { useState } from 'react'
import { api } from '../api'
import { money } from '../format'
import type { Expense, Person } from '../types'

const CATEGORIES = ['housing', 'utilities', 'transport', 'lifestyle', 'general']

interface Props {
  expenses: Expense[]
  people: Person[]
  onChange: () => Promise<void>
}

export function ExpensesPanel({ expenses, people, onChange }: Props) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [payerId, setPayerId] = useState(people[0]?.id ?? 0)
  const [category, setCategory] = useState(CATEGORIES[0])
  const [shared, setShared] = useState(true)

  const nameOf = (id: number) => people.find((person) => person.id === id)?.name ?? '—'

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!label.trim() || !amount) return
    await api.expenses.create({
      label: label.trim(),
      amount: Number(amount),
      payer_id: payerId,
      category,
      shared,
    })
    setLabel('')
    setAmount('')
    await onChange()
  }

  const patch = async (expense: Expense, payload: Partial<Expense>) => {
    await api.expenses.update(expense.id, payload)
    await onChange()
  }

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  return (
    <section className="card">
      <h2>Monthly expenses</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Amount</th>
            <th>Paid by</th>
            <th>Category</th>
            <th>Shared</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id}>
              <td>
                <input
                  defaultValue={expense.label}
                  onBlur={(event) => {
                    if (event.target.value !== expense.label) {
                      void patch(expense, { label: event.target.value })
                    }
                  }}
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={expense.amount}
                  onBlur={(event) => {
                    const value = Number(event.target.value)
                    if (value !== expense.amount) void patch(expense, { amount: value })
                  }}
                />
              </td>
              <td>
                <select
                  value={expense.payer_id}
                  onChange={(event) =>
                    void patch(expense, { payer_id: Number(event.target.value) })
                  }
                >
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value={expense.category}
                  onChange={(event) => void patch(expense, { category: event.target.value })}
                >
                  {[...new Set([...CATEGORIES, expense.category])].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={expense.shared}
                  onChange={(event) => void patch(expense, { shared: event.target.checked })}
                />
              </td>
              <td>
                <button
                  className="danger"
                  onClick={async () => {
                    await api.expenses.remove(expense.id)
                    await onChange()
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td colSpan={5}>{money(total)}</td>
          </tr>
        </tfoot>
      </table>

      <form className="add-row" onSubmit={add}>
        <input
          placeholder="New expense"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <select value={payerId} onChange={(event) => setPayerId(Number(event.target.value))}>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {CATEGORIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <label className="inline">
          <input
            type="checkbox"
            checked={shared}
            onChange={(event) => setShared(event.target.checked)}
          />
          shared
        </label>
        <button type="submit">Add</button>
      </form>
      <p className="muted">
        Shared items are split evenly; unshared ones stay with {nameOf(payerId)} or whoever pays.
      </p>
    </section>
  )
}
