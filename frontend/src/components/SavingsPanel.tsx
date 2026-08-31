import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api'
import { money, moneyCompact, moneyTooltip } from '../format'
import type { Account, Person, Projection, SavingsPlan } from '../types'
import { SliderInput } from './SliderInput'

interface Props {
  savingsPlans: SavingsPlan[]
  accounts: Account[]
  people: Person[]
  onChange: () => Promise<void>
}

export function SavingsPanel({ savingsPlans, accounts, people, onChange }: Props) {
  const [years, setYears] = useState(5)
  const [returnPct, setReturnPct] = useState(5)
  const [projection, setProjection] = useState<Projection | null>(null)

  const [institution, setInstitution] = useState('')
  const [balance, setBalance] = useState('')
  const [accountPersonId, setAccountPersonId] = useState(people[0]?.id ?? 0)

  useEffect(() => {
    void api.projection(years, returnPct).then(setProjection)
  }, [years, returnPct, savingsPlans, accounts])

  const addAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!institution.trim() || !balance) return
    await api.accounts.create({
      institution: institution.trim(),
      balance: Number(balance),
      person_id: accountPersonId,
    })
    setInstitution('')
    setBalance('')
    await onChange()
  }

  const chartData =
    projection?.points
      .filter((point) => point.month % 3 === 0 || point.month === 0)
      .map((point) => ({
        year: point.year,
        Balance: point.balance,
        Contributed: projection.starting_balance + point.contributed,
      })) ?? []

  return (
    <div className="stack">
      <section className="card">
        <h2>Monthly savings plan</h2>
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Plan</th>
              <th>Monthly amount</th>
            </tr>
          </thead>
          <tbody>
            {savingsPlans.map((plan) => (
              <tr key={plan.id}>
                <td>{people.find((person) => person.id === plan.person_id)?.name}</td>
                <td>{plan.label}</td>
                <td>
                  <input
                    type="number"
                    step="10"
                    defaultValue={plan.monthly_amount}
                    onBlur={async (event) => {
                      const value = Number(event.target.value)
                      if (value !== plan.monthly_amount) {
                        await api.savingsPlans.update(plan.id, { monthly_amount: value })
                        await onChange()
                      }
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Accounts</h2>
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Institution</th>
              <th>Balance</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{people.find((person) => person.id === account.person_id)?.name}</td>
                <td>{account.institution}</td>
                <td>
                  <input
                    type="number"
                    step="100"
                    defaultValue={account.balance}
                    onBlur={async (event) => {
                      const value = Number(event.target.value)
                      if (value !== account.balance) {
                        await api.accounts.update(account.id, { balance: value })
                        await onChange()
                      }
                    }}
                  />
                </td>
                <td>
                  <button
                    className="danger"
                    onClick={async () => {
                      await api.accounts.remove(account.id)
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
              <td colSpan={2}>Total</td>
              <td colSpan={2}>
                {money(accounts.reduce((sum, account) => sum + account.balance, 0))}
              </td>
            </tr>
          </tfoot>
        </table>

        <form className="add-row" onSubmit={addAccount}>
          <select
            value={accountPersonId}
            onChange={(event) => setAccountPersonId(Number(event.target.value))}
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Institution"
            value={institution}
            onChange={(event) => setInstitution(event.target.value)}
          />
          <input
            type="number"
            step="100"
            placeholder="Balance"
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
          />
          <button type="submit">Add</button>
        </form>
      </section>

      <section className="card">
        <h2>Savings simulator</h2>
        <div className="controls">
          <SliderInput label="Years" value={years} onChange={setYears} min={1} max={30} />
          <SliderInput
            label="Annual return"
            value={returnPct}
            onChange={setReturnPct}
            min={0}
            max={12}
            step={0.5}
            format={(value) => `${value}%`}
          />
        </div>
        {projection && (
          <p className="muted">
            Saving {money(projection.monthly_contribution)}/month on top of{' '}
            {money(projection.starting_balance)} today →{' '}
            <strong>{money(projection.points[projection.points.length - 1].balance)}</strong> in{' '}
            {years} years.
          </p>
        )}
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f2" />
            <XAxis dataKey="year" tickFormatter={(value: number) => `${value}y`} />
            <YAxis tickFormatter={moneyCompact} width={70} />
            <Tooltip formatter={moneyTooltip} />
            <Legend />
            <Area
              type="monotone"
              dataKey="Contributed"
              stroke="#8898aa"
              fill="#dfe6f5"
              name="Contributions only"
            />
            <Area
              type="monotone"
              dataKey="Balance"
              stroke="#28b487"
              fill="#bff0dd"
              name="With growth"
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  )
}
