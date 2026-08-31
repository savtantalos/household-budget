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
import { money, moneyCompact, moneyTooltip } from '../format'
import type { LumpSum, Mortgage } from '../types'

const describeLife = (months: number) => {
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (!years) return `${rest} month${rest === 1 ? '' : 's'}`
  if (rest) return `${years}y ${rest}m`
  return `${years} year${years === 1 ? '' : 's'}`
}

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

export function MortgagePanel() {
  const [principal, setPrincipal] = useState(300000)
  const [ratePct, setRatePct] = useState(4.5)
  const [termYears, setTermYears] = useState(25)
  const [overpayment, setOverpayment] = useState(0)
  const [lumpSums, setLumpSums] = useState<LumpSum[]>([])
  const [lumpMonth, setLumpMonth] = useState('12')
  const [lumpAmount, setLumpAmount] = useState('10000')

  const [result, setResult] = useState<Mortgage | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      api
        .mortgage({
          principal,
          annual_rate_pct: ratePct,
          term_years: termYears,
          monthly_overpayment: overpayment,
          lump_sums: lumpSums,
        })
        .then((value) => {
          setResult(value)
          setError(null)
        })
        .catch((err: Error) => setError(err.message))
    }, 200)
    return () => clearTimeout(timer)
  }, [principal, ratePct, termYears, overpayment, lumpSums])

  const chartData = useMemo(
    () =>
      result?.points
        .filter((point) => point.month % 3 === 0 || point.month === 0)
        .map((point) => ({
          year: point.year,
          'With overpayments': point.balance,
          'Original plan': point.baseline_balance,
        })) ?? [],
    [result],
  )

  const addLumpSum = (event: React.FormEvent) => {
    event.preventDefault()
    const month = Number(lumpMonth)
    const amount = Number(lumpAmount)
    if (!month || month < 1 || !amount) return
    setLumpSums((current) => [...current, { month, amount }])
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Mortgage</h2>
        <div className="controls">
          <label>
            Amount owed: <strong>{money(principal)}</strong>
            <input
              type="range"
              min={25000}
              max={1000000}
              step={5000}
              value={principal}
              onChange={(event) => setPrincipal(Number(event.target.value))}
            />
          </label>
          <label>
            Interest rate: <strong>{ratePct}%</strong>
            <input
              type="range"
              min={0}
              max={12}
              step={0.05}
              value={ratePct}
              onChange={(event) => setRatePct(Number(event.target.value))}
            />
          </label>
          <label>
            Term: <strong>{termYears} years</strong>
            <input
              type="range"
              min={1}
              max={40}
              value={termYears}
              onChange={(event) => setTermYears(Number(event.target.value))}
            />
          </label>
          <label>
            Monthly overpayment: <strong>{money(overpayment)}</strong>
            <input
              type="range"
              min={0}
              max={3000}
              step={25}
              value={overpayment}
              onChange={(event) => setOverpayment(Number(event.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>One-off lump sums</h2>
        <p className="muted">
          Ad-hoc payments — a bonus, savings or an inheritance — applied in a chosen month
          on top of the normal repayment.
        </p>
        {lumpSums.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>When</th>
                <th>Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...lumpSums]
                .sort((a, b) => a.month - b.month)
                .map((lump, index) => (
                  <tr key={`${lump.month}-${lump.amount}-${index}`}>
                    <td>{lump.month}</td>
                    <td>{describeLife(lump.month)} in</td>
                    <td>{money(lump.amount)}</td>
                    <td>
                      <button
                        className="danger"
                        onClick={() =>
                          setLumpSums((current) =>
                            current.filter(
                              (item) =>
                                !(item.month === lump.month && item.amount === lump.amount),
                            ),
                          )
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
        <form className="add-row" onSubmit={addLumpSum}>
          <input
            type="number"
            min={1}
            placeholder="Month"
            value={lumpMonth}
            onChange={(event) => setLumpMonth(event.target.value)}
          />
          <input
            type="number"
            step="500"
            placeholder="Amount"
            value={lumpAmount}
            onChange={(event) => setLumpAmount(event.target.value)}
          />
          <button type="submit">Add lump sum</button>
        </form>
      </section>

      {error && (
        <div className="card error">
          <strong>Could not run the simulation.</strong>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <>
          <section className="stat-grid">
            <Stat
              label="Monthly repayment"
              value={money(result.monthly_payment)}
              hint={overpayment > 0 ? `plus ${money(overpayment)} overpaid` : undefined}
            />
            <Stat
              label="Mortgage life"
              value={describeLife(result.months_to_repay)}
              hint={
                result.months_saved > 0
                  ? `${describeLife(result.months_saved)} earlier than planned`
                  : `${termYears} year term`
              }
            />
            <Stat
              label="Total interest"
              value={money(result.total_interest)}
              hint={`${money(result.total_paid)} repaid in total`}
            />
            <Stat
              label="Interest saved"
              value={money(result.interest_saved)}
              tone={result.interest_saved > 0 ? 'positive' : undefined}
              hint={`vs ${money(result.baseline_total_interest)} on the original plan`}
            />
          </section>

          <section className="card">
            <h2>Balance over time</h2>
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f2" />
                <XAxis dataKey="year" tickFormatter={(value: number) => `${value}y`} />
                <YAxis tickFormatter={moneyCompact} width={70} />
                <Tooltip formatter={moneyTooltip} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Original plan"
                  stroke="#8898aa"
                  fill="#dfe6f5"
                />
                <Area
                  type="monotone"
                  dataKey="With overpayments"
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
