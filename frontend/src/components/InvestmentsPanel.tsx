import { useEffect, useMemo, useState } from 'react'
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
import { describeLife, money, moneyCompact, moneyTooltip } from '../format'
import type { Comparison, Investment, Person, Projection } from '../types'
import { SliderInput } from './SliderInput'

const MAX_CHART_POINTS = 120

interface Props {
  investments: Investment[]
  people: Person[]
  onChange: () => Promise<void>
}

export function InvestmentsPanel({ investments, people, onChange }: Props) {
  const [years, setYears] = useState(10)
  const [projection, setProjection] = useState<Projection | null>(null)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('index fund')
  const [balance, setBalance] = useState('')
  const [contribution, setContribution] = useState('')
  const [returnPct, setReturnPct] = useState('5')
  const [personId, setPersonId] = useState(people[0]?.id ?? 0)

  // Invest-vs-overpay comparison inputs
  const [principal, setPrincipal] = useState(300000)
  const [mortgageRate, setMortgageRate] = useState(4.5)
  const [termYears, setTermYears] = useState(25)
  const [monthlyAmount, setMonthlyAmount] = useState(500)
  const [investReturn, setInvestReturn] = useState(7)
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void api.investmentProjection(years).then(setProjection)
  }, [years, investments])

  useEffect(() => {
    const timer = setTimeout(() => {
      api
        .investVsOverpay({
          principal,
          annual_rate_pct: mortgageRate,
          term_years: termYears,
          monthly_amount: monthlyAmount,
          annual_return_pct: investReturn,
        })
        .then((value) => {
          setComparison(value)
          setError(null)
        })
        .catch((err: Error) => setError(err.message))
    }, 200)
    return () => clearTimeout(timer)
  }, [principal, mortgageRate, termYears, monthlyAmount, investReturn])

  const projectionData =
    projection?.points
      .filter((point) => point.month % 3 === 0 || point.month === 0)
      .map((point) => ({
        year: point.year,
        'With growth': point.balance,
        'Contributions only': projection.starting_balance + point.contributed,
      })) ?? []

  const comparisonData = useMemo(() => {
    const points = comparison?.points ?? []
    const step = Math.max(1, Math.ceil(points.length / MAX_CHART_POINTS))
    return points
      .filter((_, index) => index % step === 0 || index === points.length - 1)
      .map((point) => ({
        year: point.year,
        Invest: point.invest_wealth,
        'Overpay mortgage': point.overpay_wealth,
      }))
  }, [comparison])

  const addInvestment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    await api.investments.create({
      person_id: personId,
      name: name.trim(),
      category: category.trim() || 'index fund',
      balance: Number(balance) || 0,
      monthly_contribution: Number(contribution) || 0,
      annual_return_pct: Number(returnPct) || 0,
    })
    setName('')
    setBalance('')
    setContribution('')
    await onChange()
  }

  const numberCell = (
    investment: Investment,
    field: 'balance' | 'monthly_contribution' | 'annual_return_pct',
    step: string,
  ) => (
    <input
      type="number"
      step={step}
      defaultValue={investment[field]}
      onBlur={async (event) => {
        const value = Number(event.target.value)
        if (value !== investment[field]) {
          await api.investments.update(investment.id, { [field]: value })
          await onChange()
        }
      }}
    />
  )

  return (
    <div className="stack">
      <section className="card">
        <h2>Investments</h2>
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Name</th>
              <th>Category</th>
              <th>Value today</th>
              <th>Monthly top-up</th>
              <th>Expected return %</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {investments.map((investment) => (
              <tr key={investment.id}>
                <td>
                  {people.find((person) => person.id === investment.person_id)?.name}
                </td>
                <td>{investment.name}</td>
                <td>{investment.category}</td>
                <td>{numberCell(investment, 'balance', '100')}</td>
                <td>{numberCell(investment, 'monthly_contribution', '10')}</td>
                <td>{numberCell(investment, 'annual_return_pct', '0.1')}</td>
                <td>
                  <button
                    className="danger"
                    onClick={async () => {
                      await api.investments.remove(investment.id)
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
              <td colSpan={3}>Total</td>
              <td>{money(investments.reduce((sum, inv) => sum + inv.balance, 0))}</td>
              <td>
                {money(
                  investments.reduce((sum, inv) => sum + inv.monthly_contribution, 0),
                )}
                /month
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>

        <form className="add-row" onSubmit={addInvestment}>
          <select
            value={personId}
            onChange={(event) => setPersonId(Number(event.target.value))}
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            placeholder="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
          <input
            type="number"
            step="100"
            placeholder="Value"
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
          />
          <input
            type="number"
            step="10"
            placeholder="Monthly"
            value={contribution}
            onChange={(event) => setContribution(event.target.value)}
          />
          <input
            type="number"
            step="0.1"
            placeholder="Return %"
            value={returnPct}
            onChange={(event) => setReturnPct(event.target.value)}
          />
          <button type="submit">Add</button>
        </form>
      </section>

      <section className="card">
        <h2>Growth projection</h2>
        <div className="controls">
          <SliderInput label="Years" value={years} onChange={setYears} min={1} max={40} />
        </div>
        {projection && projection.points.length > 0 && (
          <p className="muted">
            {money(projection.starting_balance)} today plus{' '}
            {money(projection.monthly_contribution)}/month, each holding at its own
            return →{' '}
            <strong>
              {money(projection.points[projection.points.length - 1].balance)}
            </strong>{' '}
            in {years} years.
          </p>
        )}
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={projectionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f2" />
            <XAxis dataKey="year" tickFormatter={(value: number) => `${value}y`} />
            <YAxis tickFormatter={moneyCompact} width={70} />
            <Tooltip formatter={moneyTooltip} />
            <Legend />
            <Area
              type="monotone"
              dataKey="Contributions only"
              stroke="#8898aa"
              fill="#dfe6f5"
            />
            <Area type="monotone" dataKey="With growth" stroke="#28b487" fill="#bff0dd" />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <h2>Invest or overpay the mortgage?</h2>
        <p className="muted">
          The same spare cash each month, two strategies: invest it, or overpay the
          mortgage and invest the freed-up repayment once the mortgage clears. Interest
          paid counts against each side.
        </p>
        <div className="controls">
          <SliderInput
            label="Mortgage owed"
            value={principal}
            onChange={setPrincipal}
            min={25000}
            max={1000000}
            step={5000}
            format={money}
          />
          <SliderInput
            label="Mortgage rate"
            value={mortgageRate}
            onChange={setMortgageRate}
            min={0}
            max={12}
            step={0.05}
            format={(value) => `${value}%`}
          />
          <SliderInput
            label="Term"
            value={termYears}
            onChange={setTermYears}
            min={1}
            max={40}
            format={(value) => `${value} years`}
          />
          <SliderInput
            label="Spare cash per month"
            value={monthlyAmount}
            onChange={setMonthlyAmount}
            min={25}
            max={5000}
            step={25}
            format={money}
          />
          <SliderInput
            label="Investment return"
            value={investReturn}
            onChange={setInvestReturn}
            min={0}
            max={15}
            step={0.1}
            format={(value) => `${value}%`}
          />
        </div>
      </section>

      {error && (
        <div className="card error">
          <strong>Could not run the comparison.</strong>
          <p>{error}</p>
        </div>
      )}

      {comparison && (
        <>
          <section className="stat-grid">
            <div className="stat">
              <span className="stat-label">Better strategy</span>
              <span className="stat-value positive">
                {comparison.winner === 'invest' ? 'Invest' : 'Overpay mortgage'}
              </span>
              <span className="stat-hint">
                ahead by {money(comparison.advantage)} after {termYears} years
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Investing: final pot</span>
              <span className="stat-value">{money(comparison.invest_final_pot)}</span>
              <span className="stat-hint">
                {money(comparison.invest_total_interest)} mortgage interest paid
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Overpaying: final pot</span>
              <span className="stat-value">{money(comparison.overpay_final_pot)}</span>
              <span className="stat-hint">
                {money(comparison.overpay_total_interest)} mortgage interest paid
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Overpaying clears the mortgage in</span>
              <span className="stat-value">
                {describeLife(comparison.overpay_months_to_repay)}
              </span>
              <span className="stat-hint">then the repayment is invested too</span>
            </div>
          </section>

          <section className="card">
            <h2>Investment pot over time</h2>
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f2" />
                <XAxis dataKey="year" tickFormatter={(value: number) => `${value}y`} />
                <YAxis tickFormatter={moneyCompact} width={70} />
                <Tooltip formatter={moneyTooltip} />
                <Legend />
                <Area type="monotone" dataKey="Invest" stroke="#28b487" fill="#bff0dd" />
                <Area
                  type="monotone"
                  dataKey="Overpay mortgage"
                  stroke="#2f6fed"
                  fill="#c9dbff"
                />
              </AreaChart>
            </ResponsiveContainer>
          </section>
        </>
      )}
    </div>
  )
}
