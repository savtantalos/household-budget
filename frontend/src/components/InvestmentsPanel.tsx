import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api'
import {
  chartColor,
  describeLife,
  money,
  moneyCompact,
  moneyTooltip,
  parseChartColors,
} from '../format'
import type { Comparison, Investment, Person, Projection, Settings } from '../types'
import { SliderInput } from './SliderInput'

const MAX_CHART_POINTS = 120

const PRESET_COLOURS = ['#2f6fed', '#e0629b', '#28b487', '#f5a623', '#7c5cff']

interface Props {
  investments: Investment[]
  people: Person[]
  onChange: () => Promise<void>
  settings: Settings
  onSettingsChange: (payload: Partial<Settings>) => void
}

export function InvestmentsPanel({
  investments,
  people,
  onChange,
  settings,
  onSettingsChange,
}: Props) {
  const years = settings.investment_projection_years
  const [projection, setProjection] = useState<Projection | null>(null)
  const [projectionError, setProjectionError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('index fund')
  const [balance, setBalance] = useState('')
  const [contribution, setContribution] = useState('')
  const [returnPct, setReturnPct] = useState('5')
  const [personId, setPersonId] = useState(people[0]?.id ?? 0)
  const [colour, setColour] = useState(PRESET_COLOURS[0])

  // Invest-vs-overpay comparison inputs
  const principal = settings.invest_principal
  const mortgageRate = settings.invest_mortgage_rate_pct
  const termYears = settings.invest_term_years
  const monthlyAmount = settings.invest_monthly_amount
  const investReturn = settings.invest_annual_return_pct
  const comparisonYears = settings.invest_comparison_years ?? termYears
  const returnSpread = settings.invest_return_spread_pct
  const [scenarios, setScenarios] = useState<Comparison[] | null>(null)
  const comparison = scenarios?.[1] ?? null
  const [error, setError] = useState<string | null>(null)

  const colors = parseChartColors(settings)

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      void api.investmentProjection(years)
        .then((value) => {
          if (!active) return
          setProjection(value)
          setProjectionError(null)
        })
        .catch((err: Error) => {
          if (active) setProjectionError(err.message)
        })
    }, 200)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [years, investments])

  useEffect(() => {
    let active = true
    setScenarios(null)
    setError(null)
    const timer = setTimeout(() => {
      const returns = [
        Math.max(-30, investReturn - returnSpread),
        investReturn,
        Math.min(30, investReturn + returnSpread),
      ]
      void Promise.all(returns.map((annualReturn) => api.investVsOverpay({
        principal,
        annual_rate_pct: mortgageRate,
        term_years: termYears,
        monthly_amount: monthlyAmount,
        annual_return_pct: annualReturn,
        comparison_years: comparisonYears,
      })))
        .then((values) => {
          if (!active) return
          setScenarios(values)
          setError(null)
        })
        .catch((err: Error) => {
          if (active) setError(err.message)
        })
    }, 200)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [principal, mortgageRate, termYears, monthlyAmount, investReturn, comparisonYears, returnSpread])

  const projectionData = useMemo(() => {
    if (!projection) return []
    return projection.points
      .filter((point) => point.month % 3 === 0 || point.month === 0)
      .map((point) => {
        const row: Record<string, number> = {
          year: point.year,
          total: point.balance,
          contributions: projection.starting_balance + point.contributed,
        }
        projection.investments?.forEach((inv) => {
          row[`investment-${inv.id}`] = inv.points[point.month]?.balance ?? 0
        })
        return row
      })
  }, [projection])

  const comparisonData = useMemo(() => {
    const points = comparison?.points ?? []
    const step = Math.max(1, Math.ceil(points.length / MAX_CHART_POINTS))
    return points
      .filter((_, index) => index % step === 0 || index === points.length - 1)
      .map((point) => ({
        year: point.year,
        invest: point.invest_net_position,
        overpay: point.overpay_net_position,
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
      color: colour,
    })
    setName('')
    setBalance('')
    setContribution('')
    setColour(PRESET_COLOURS[0])
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
              <th>Colour</th>
              <th>Value today</th>
              <th>Monthly top-up</th>
              <th>Expected annual return %</th>
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
                <td>
                  <select
                    defaultValue={investment.color || PRESET_COLOURS[0]}
                    onBlur={async (event) => {
                      const value = event.target.value
                      if (value !== investment.color) {
                        await api.investments.update(investment.id, { color: value })
                        await onChange()
                      }
                    }}
                    style={{ width: 'auto' }}
                  >
                    {PRESET_COLOURS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="color"
                    defaultValue={investment.color || PRESET_COLOURS[0]}
                    onBlur={async (event) => {
                      const value = event.target.value
                      if (value !== investment.color) {
                        await api.investments.update(investment.id, { color: value })
                        await onChange()
                      }
                    }}
                    style={{ width: 60, padding: 2, cursor: 'pointer' }}
                  />
                </td>
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
              <td colSpan={4}>Total</td>
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
          <select
            value={colour}
            onChange={(event) => setColour(event.target.value)}
            style={{ width: 'auto' }}
          >
            {PRESET_COLOURS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="color"
            value={colour}
            onChange={(event) => setColour(event.target.value)}
            style={{ width: 60, padding: 2, cursor: 'pointer' }}
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
            placeholder="Annual return %"
            value={returnPct}
            onChange={(event) => setReturnPct(event.target.value)}
          />
          <button type="submit">Add</button>
        </form>
      </section>

      <section className="card">
        <h2>Growth projection</h2>
        <div className="controls">
          <SliderInput
            label="Years"
            value={years}
            onChange={(value) => onSettingsChange({ investment_projection_years: value })}
            min={1}
            max={40}
          />
        </div>
        {projectionError && (
          <div className="error">
            <strong>Could not run the investment projection.</strong>
            <p>{projectionError}</p>
          </div>
        )}
        {projection && projection.points.length > 0 && (
          <p className="muted">
            {money(projection.starting_balance)} today plus{' '}
            {money(projection.monthly_contribution)}/month, each holding growing at its own
            annual rate →{' '}
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
              dataKey="contributions"
              stroke={chartColor('investment-contributions', 0, colors)}
              fill={chartColor('investment-contributions', 0, colors)}
              fillOpacity={0.15}
              name="Contributions only"
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={chartColor('investment-total', 0, colors)}
              fill={chartColor('investment-total', 0, colors)}
              fillOpacity={0.25}
              name="Total"
            />
            {projection?.investments?.map((inv, index) => {
              const holding = investments.find((i) => i.id === inv.id)
              return (
                <Line
                  key={inv.id}
                  type="monotone"
                  dataKey={`investment-${inv.id}`}
                  name={inv.name}
                  stroke={
                    holding?.color ||
                    chartColor(`investment-${inv.id}`, index, colors)
                  }
                  strokeWidth={2}
                  dot={false}
                />
              )
            })}
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <h2>Invest or overpay the mortgage?</h2>
        <p className="muted">
          The same monthly budget, compared at the same future date. Invest the spare
          cash, or overpay the mortgage and then invest the freed-up budget, including
          any unused cash in the payoff month.
        </p>
        <div className="controls">
          <SliderInput
            label="Mortgage owed"
            value={principal}
            onChange={(value) => onSettingsChange({ invest_principal: value })}
            min={25000}
            max={1000000}
            step={5000}
            format={money}
          />
          <SliderInput
            label="Mortgage rate (annual, nominal)"
            value={mortgageRate}
            onChange={(value) => onSettingsChange({ invest_mortgage_rate_pct: value })}
            min={0}
            max={12}
            step={0.05}
            format={(value) => `${value}%`}
          />
          <SliderInput
            label="Remaining mortgage term"
            value={termYears}
            onChange={(value) => onSettingsChange({ invest_term_years: value })}
            min={1}
            max={40}
            format={(value) => `${value} years`}
          />
          <SliderInput
            label="Compare after"
            value={comparisonYears}
            onChange={(value) => onSettingsChange({ invest_comparison_years: value })}
            min={1}
            max={40}
            format={(value) => `${value} years`}
          />
          <SliderInput
            label="Spare cash per month"
            value={monthlyAmount}
            onChange={(value) => onSettingsChange({ invest_monthly_amount: value })}
            min={25}
            max={5000}
            step={25}
            format={money}
          />
          <SliderInput
            label="Base investment return (annual, after costs)"
            value={investReturn}
            onChange={(value) => onSettingsChange({ invest_annual_return_pct: value })}
            min={-30}
            max={30}
            step={0.1}
            format={(value) => `${value}%`}
          />
          <SliderInput
            label="Low/high return variation"
            value={returnSpread}
            onChange={(value) => onSettingsChange({ invest_return_spread_pct: value })}
            min={0}
            max={15}
            step={0.5}
            format={(value) => `±${value} percentage points`}
          />
        </div>
        <p className="muted">
          The mortgage term is the time to repay the loan, not the fixed-rate deal length.
          {settings.invest_comparison_years === null
            ? ' The comparison currently follows the mortgage term; adjust “Compare after” to set a separate horizon.'
            : ' The comparison horizon is independent of the mortgage term.'}
        </p>
        <details>
          <summary>Assumptions and limitations</summary>
          <p className="muted">
            Investment returns are effective annual rates: enter estimates after fees and
            applicable taxes. The mortgage rate is divided by 12 for monthly interest.
            Both rates stay constant; payments and investment contributions occur at month end.
            All figures are future pounds, not inflation-adjusted.
          </p>
          <p className="muted">
            No early-repayment charges, overpayment limits or future mortgage-rate changes
            are modelled. Investment returns are uncertain and losses are possible; interest
            avoided is more predictable at a known mortgage rate. Money paid into the
            mortgage is generally harder to access than investments.
          </p>
        </details>
      </section>

      {error && (
        <div className="card error" role="alert">
          <strong>Could not run the comparison.</strong>
          <p>{error}</p>
        </div>
      )}
      {!comparison && !error && <p role="status">Calculating comparison scenarios…</p>}

      {comparison && (
        <>
          <section className="stat-grid">
            <div className="stat">
              <span className="stat-label">Projected advantage under these assumptions</span>
              <span className="stat-value">
                {comparison.winner === 'tie'
                  ? 'No difference'
                  : comparison.winner === 'invest' ? 'Invest' : 'Overpay mortgage'}
              </span>
              <span className="stat-hint">
                {money(comparison.advantage)} difference after {comparison.comparison_years} years
                {' '}at {comparison.annual_return_pct}% investment return
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Investing: net financial position</span>
              <span className="stat-value">{money(comparison.invest_net_position)}</span>
              <span className="stat-hint">investments minus remaining mortgage</span>
            </div>
            <div className="stat">
              <span className="stat-label">Overpaying: net financial position</span>
              <span className="stat-value">{money(comparison.overpay_net_position)}</span>
              <span className="stat-hint">investments minus remaining mortgage</span>
            </div>
            <div className="stat">
              <span className="stat-label">Mortgage interest saved by overpaying</span>
              <span className="stat-value">{money(comparison.interest_saved)}</span>
              <span className="stat-hint">
                over {comparison.comparison_years} years; already included in the net positions
              </span>
            </div>
          </section>

          <section className="card">
            <h2>Net financial position over time</h2>
            <p className="muted">
              Investments minus outstanding mortgage debt, using the base return.
              Higher is better. The house value is excluded because it is identical
              in both strategies, so a negative figure does not mean negative total net worth.
            </p>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f2" />
                <XAxis dataKey="year" tickFormatter={(value: number) => `${value}y`} />
                <YAxis tickFormatter={moneyCompact} width={80} domain={['auto', 'auto']} />
                <Tooltip formatter={moneyTooltip} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="invest"
                  stroke={chartColor('invest-vs-overpay-invest', 0, colors)}
                  strokeWidth={2}
                  dot={false}
                  name="Invest"
                />
                <Line
                  type="monotone"
                  dataKey="overpay"
                  stroke={chartColor('invest-vs-overpay-overpay', 0, colors)}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  name="Overpay mortgage"
                />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section className="card">
            <h2>Base-case breakdown after {comparison.comparison_years} years</h2>
            <p className="muted">
              Scheduled mortgage repayment: {money(comparison.monthly_payment)} per month.
              Both strategies also use the same spare cash each month and invest the
              full budget after their mortgage clears. Interest savings are not added again.
            </p>
            <table>
              <thead>
                <tr><th scope="col">Measure</th><th scope="col">Invest</th><th scope="col">Overpay mortgage</th></tr>
              </thead>
              <tbody>
                {([
                  ['Investment contributions', comparison.invest_contributed, comparison.overpay_contributed],
                  ['Investment growth / loss', comparison.invest_growth, comparison.overpay_growth],
                  ['Investment pot', comparison.invest_final_pot, comparison.overpay_final_pot],
                  ['Remaining mortgage debt', comparison.invest_remaining_balance, comparison.overpay_remaining_balance],
                  ['Mortgage interest paid', comparison.invest_total_interest, comparison.overpay_total_interest],
                  ['Net financial position', comparison.invest_net_position, comparison.overpay_net_position],
                ] as const).map(([label, invest, overpay]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th><td>{money(invest)}</td><td>{money(overpay)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">Mortgage cleared from now</th>
                  <td>{describeLife(comparison.invest_months_to_repay)}</td>
                  <td>{describeLife(comparison.overpay_months_to_repay)}</td>
                </tr>
              </tbody>
            </table>
            <p className="muted">
              Payoff times assume each strategy continues, even beyond the comparison date.
            </p>
          </section>

          <section className="card">
            <h2>Investment return scenarios</h2>
            <p className="muted">
              Low, base and high constant-return assumptions—not predictions or confidence
              intervals. Low/high rates use your variation and are limited to −30% to 30%.
              All three use the same mortgage assumptions and comparison date.
            </p>
            <div className="stat-grid">
              {scenarios?.map((scenario, index) => (
                <div className="stat" key={index}>
                  <span className="stat-label">
                    {['Low', 'Base', 'High'][index]}: {Number(scenario.annual_return_pct.toFixed(2))}% annual return
                  </span>
                  <span className="stat-value">
                    {scenario.winner === 'tie'
                      ? 'No difference'
                      : scenario.winner === 'invest' ? 'Invest ahead' : 'Overpay ahead'}
                  </span>
                  <span className="stat-hint">by {money(scenario.advantage)} after {scenario.comparison_years} years</span>
                  <p>Invest: {money(scenario.invest_net_position)}</p>
                  <p>Overpay: {money(scenario.overpay_net_position)}</p>
                  <span className="stat-hint">net financial positions</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
