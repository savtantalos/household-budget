import { useState } from 'react'
import { api } from '../api'
import { money } from '../format'
import type { Frequency, Income, Person, Transfer } from '../types'

const FREQUENCIES: Frequency[] = ['monthly', 'yearly', 'one_off']

interface Props {
  incomes: Income[]
  transfers: Transfer[]
  people: Person[]
  onChange: () => Promise<void>
}

export function IncomePanel({ incomes, transfers, people, onChange }: Props) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [personId, setPersonId] = useState(people[0]?.id ?? 0)
  const [frequency, setFrequency] = useState<Frequency>('monthly')

  const [transferLabel, setTransferLabel] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [fromId, setFromId] = useState(people[0]?.id ?? 0)
  const [toId, setToId] = useState(people[1]?.id ?? people[0]?.id ?? 0)

  const addIncome = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!label.trim() || !amount) return
    await api.incomes.create({
      label: label.trim(),
      amount: Number(amount),
      person_id: personId,
      frequency,
    })
    setLabel('')
    setAmount('')
    await onChange()
  }

  const addTransfer = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!transferLabel.trim() || !transferAmount || fromId === toId) return
    await api.transfers.create({
      label: transferLabel.trim(),
      amount: Number(transferAmount),
      from_person_id: fromId,
      to_person_id: toId,
    })
    setTransferLabel('')
    setTransferAmount('')
    await onChange()
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Income</h2>
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Amount</th>
              <th>Person</th>
              <th>Frequency</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {incomes.map((income) => (
              <tr key={income.id}>
                <td>
                  <input
                    defaultValue={income.label}
                    onBlur={async (event) => {
                      if (event.target.value !== income.label) {
                        await api.incomes.update(income.id, { label: event.target.value })
                        await onChange()
                      }
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={income.amount}
                    onBlur={async (event) => {
                      const value = Number(event.target.value)
                      if (value !== income.amount) {
                        await api.incomes.update(income.id, { amount: value })
                        await onChange()
                      }
                    }}
                  />
                </td>
                <td>
                  <select
                    value={income.person_id}
                    onChange={async (event) => {
                      await api.incomes.update(income.id, {
                        person_id: Number(event.target.value),
                      })
                      await onChange()
                    }}
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
                    value={income.frequency}
                    onChange={async (event) => {
                      await api.incomes.update(income.id, {
                        frequency: event.target.value as Frequency,
                      })
                      await onChange()
                    }}
                  >
                    {FREQUENCIES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    className="danger"
                    onClick={async () => {
                      await api.incomes.remove(income.id)
                      await onChange()
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form className="add-row" onSubmit={addIncome}>
          <input
            placeholder="New income"
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
          <select value={personId} onChange={(event) => setPersonId(Number(event.target.value))}>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <select
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as Frequency)}
          >
            {FREQUENCIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button type="submit">Add</button>
        </form>
      </section>

      <section className="card">
        <h2>Person-to-person transfers</h2>
        <p className="muted">
          Recurring money moving between you two — loan repayments, one covering the other.
        </p>
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>From</th>
              <th>To</th>
              <th>Monthly</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id}>
                <td>{transfer.label}</td>
                <td>{people.find((p) => p.id === transfer.from_person_id)?.name}</td>
                <td>{people.find((p) => p.id === transfer.to_person_id)?.name}</td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={transfer.amount}
                    onBlur={async (event) => {
                      const value = Number(event.target.value)
                      if (value !== transfer.amount) {
                        await api.transfers.update(transfer.id, { amount: value })
                        await onChange()
                      }
                    }}
                  />
                </td>
                <td>
                  <button
                    className="danger"
                    onClick={async () => {
                      await api.transfers.remove(transfer.id)
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
              <td colSpan={3}>Total moved monthly</td>
              <td colSpan={2}>
                {money(transfers.reduce((sum, transfer) => sum + transfer.amount, 0))}
              </td>
            </tr>
          </tfoot>
        </table>

        <form className="add-row" onSubmit={addTransfer}>
          <input
            placeholder="e.g. Barclays loan"
            value={transferLabel}
            onChange={(event) => setTransferLabel(event.target.value)}
          />
          <select value={fromId} onChange={(event) => setFromId(Number(event.target.value))}>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                from {person.name}
              </option>
            ))}
          </select>
          <select value={toId} onChange={(event) => setToId(Number(event.target.value))}>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                to {person.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            placeholder="Monthly amount"
            value={transferAmount}
            onChange={(event) => setTransferAmount(event.target.value)}
          />
          <button type="submit">Add</button>
        </form>
      </section>
    </div>
  )
}
