import { useMemo, useState } from 'react'
import { api } from '../api'
import { money } from '../format'
import type { Category, Expense, Frequency, Person } from '../types'

const FREQUENCIES: Frequency[] = ['monthly', 'yearly', 'one_off']

interface Props {
  expenses: Expense[]
  people: Person[]
  categories: Category[]
  onChange: () => Promise<void>
}

export function ExpensesPanel({ expenses, people, categories, onChange }: Props) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [payerId, setPayerId] = useState(people[0]?.id ?? 0)
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0)
  const [shared, setShared] = useState(true)
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [dueDay, setDueDay] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const categoryNames = useMemo(
    () => categories.map((c) => c.name).sort(),
    [categories]
  )

  const ensureCategory = async (name: string) => {
    const trimmed = name.trim().toLowerCase()
    if (!trimmed) return
    if (categoryNames.includes(trimmed)) return
    await api.categories.create({ name: trimmed })
  }

  const selectedCategory = categories.find((category) => category.id === categoryId) ?? categories[0]

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!label.trim() || !amount || !selectedCategory) return
    try {
      await api.expenses.create({
        label: label.trim(),
        amount: Number(amount),
        payer_id: payerId,
        category: selectedCategory.name,
        shared,
        frequency,
        due_day: frequency === 'monthly' && dueDay ? Number(dueDay) : null,
        due_date: frequency !== 'monthly' && dueDate ? dueDate : null,
      })
      setLabel('')
      setAmount('')
      setDueDay('')
      setDueDate('')
      await onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expense')
    }
  }

  const patch = async (expense: Expense, payload: Partial<Expense>) => {
    setError(null)
    try {
      if (payload.category !== undefined && !categoryNames.includes(payload.category)) {
        setError('Choose a category from the Categories list.')
        return
      }
      await api.expenses.update(expense.id, payload)
      await onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update expense')
    }
  }

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  const renameCategory = async (category: Category, value: string) => {
    const trimmed = value.trim().toLowerCase()
    if (!trimmed || trimmed === category.name) return
    try {
      await api.categories.update(category.id, { name: trimmed })
      await onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename category')
    }
  }

  const deleteCategory = async (category: Category) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) return
    try {
      await api.categories.remove(category.id)
      await onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category')
    }
  }

  const nameOf = (id: number) => people.find((person) => person.id === id)?.name ?? '—'

  return (
    <div className="stack">
      <section className="card">
        <h2>Monthly expenses</h2>
        {error && (
          <div className="card error" style={{ marginBottom: '1rem' }}>
            <p>{error}</p>
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Amount</th>
              <th>Paid by</th>
              <th>Category</th>
              <th>Frequency</th>
              <th>Pay date</th>
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
                    aria-label={`Category for ${expense.label}`}
                    value={categoryNames.includes(expense.category) ? expense.category : ''}
                    disabled={categories.length === 0}
                    onChange={(event) => {
                      if (event.target.value !== expense.category) {
                        void patch(expense, { category: event.target.value })
                      }
                    }}
                  >
                    {!categoryNames.includes(expense.category) && (
                      <option value="" disabled>
                        {categories.length === 0 ? 'Add a category below' : 'Select a category'}
                      </option>
                    )}
                    {categoryNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    aria-label={`Frequency for ${expense.label}`}
                    value={expense.frequency}
                    onChange={(event) =>
                      void patch(expense, {
                        frequency: event.target.value as Frequency,
                      })
                    }
                  >
                    {FREQUENCIES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {expense.frequency === 'monthly' ? (
                    <input
                      type="number"
                      min={1}
                      max={31}
                      placeholder="day"
                      aria-label={`Pay day for ${expense.label}`}
                      style={{ width: '4.5rem' }}
                      key={`${expense.id}-day-${expense.due_day}`}
                      defaultValue={expense.due_day ?? ''}
                      onBlur={(event) => {
                        const raw = event.target.value.trim()
                        const value = raw ? Number(raw) : null
                        if (value !== null && (value < 1 || value > 31)) {
                          event.target.value = expense.due_day?.toString() ?? ''
                          return
                        }
                        if (value !== expense.due_day) {
                          void patch(expense, { due_day: value })
                        }
                      }}
                    />
                  ) : (
                    <input
                      type="date"
                      aria-label={`Pay date for ${expense.label}`}
                      key={`${expense.id}-date-${expense.due_date}`}
                      defaultValue={expense.due_date ?? ''}
                      onChange={(event) => {
                        const value = event.target.value || null
                        if (value !== expense.due_date) {
                          void patch(expense, { due_date: value })
                        }
                      }}
                    />
                  )}
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={expense.shared}
                    onChange={(event) =>
                      void patch(expense, { shared: event.target.checked })
                    }
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
              <td colSpan={7}>{money(total)}</td>
            </tr>
          </tfoot>
        </table>

        <form className="add-row" onSubmit={(event) => void add(event)}>
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
          <select
            aria-label="New expense category"
            value={selectedCategory?.name ?? ''}
            disabled={!selectedCategory}
            onChange={(event) => {
              const selected = categories.find((category) => category.name === event.target.value)
              if (selected) setCategoryId(selected.id)
            }}
          >
            {!selectedCategory && <option value="">Add a category below</option>}
            {categoryNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="New expense frequency"
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as Frequency)}
          >
            {FREQUENCIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {frequency === 'monthly' ? (
            <input
              type="number"
              min={1}
              max={31}
              placeholder="Pay day"
              aria-label="New expense pay day"
              style={{ width: '5.5rem' }}
              value={dueDay}
              onChange={(event) => setDueDay(event.target.value)}
            />
          ) : (
            <input
              type="date"
              aria-label="New expense pay date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          )}
          <label className="inline">
            <input
              type="checkbox"
              checked={shared}
              onChange={(event) => setShared(event.target.checked)}
            />
            shared
          </label>
          <button type="submit" disabled={!selectedCategory}>Add</button>
        </form>
        <p className="muted">
          Shared items are split evenly; unshared ones stay with {nameOf(payerId)} or whoever pays.
          Pay day is the day of the month a monthly expense leaves the account; yearly and one-off
          expenses use a full date.
        </p>
      </section>

      <section className="card">
        <h2>Categories</h2>
        <p className="muted">
          Add, rename or remove categories. A category can only be deleted when no expenses use it.
        </p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td>
                  <input
                    defaultValue={cat.name}
                    onBlur={(event) => void renameCategory(cat, event.target.value)}
                  />
                </td>
                <td>
                  <button className="danger" onClick={() => void deleteCategory(cat)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form
          className="add-row"
          onSubmit={(event) => {
            event.preventDefault()
            const input = event.currentTarget.elements.namedItem('new-category') as HTMLInputElement
            const name = input.value.trim()
            if (!name) return
            void ensureCategory(name).then(() => {
              input.value = ''
              void onChange()
            })
          }}
        >
          <input name="new-category" placeholder="New category" />
          <button type="submit">Add category</button>
        </form>
      </section>
    </div>
  )
}
