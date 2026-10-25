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
import {
  chartColor,
  describeLife,
  money,
  moneyCompact,
  moneyTooltip,
  parseChartColors,
} from '../format'
import type { LumpSum, Mortgage, Settings } from '../types'
import { SliderInput } from './SliderInput'

const MAX_CHART_POINTS = 120

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

interface Props {
  settings: Settings
  onSettingsChange: (payload: Partial<Settings>) => void
}

export function MortgagePanel({ settings, onSettingsChange }: Props) {
  const principal = settings.mortgage_principal
  const ratePct = settings.mortgage_rate_pct
  const termYears = settings.mortgage_term_years
  const overpayment = settings.mortgage_overpayment
  const lumpMonth = settings.mortgage_lump_month
  const lumpAmount = settings.mortgage_lump_amount
  const lumpSums = useMemo<LumpSum[]>(() => {
    try {
      const parsed: unknown = JSON.parse(settings.mortgage_lump_sums)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (item): item is LumpSum =>
          item !== null &&
          typeof item === 'object' &&
          typeof item.month === 'number' &&
          Number.isFinite(item.month) &&
          typeof item.amount === 'number' &&
          Number.isFinite(item.amount),
      )
    } catch {
      return []
    }
  }, [settings.mortgage_lump_sums])

  const [result, setResult] = useState<Mortgage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const colors = parseChartColors(settings)

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      void api
        .mortgage({
          principal,
          annual_rate_pct: ratePct,
          term_years: termYears,
          monthly_overpayment: overpayment,
          lump_sums: lumpSums,
        })
        .then((value) => {
          if (!active) return
          setResult(value)
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
  }, [principal, ratePct, termYears, overpayment, lumpSums])

  const chartData = useMemo(() => {
    const points = result?.points ?? []
    const step = Math.max(1, Math.ceil(points.length / MAX_CHART_POINTS))
    return points
      .filter((_, index) => index % step === 0 || index === points.length - 1)
      .map((point) => ({
        year: point.year,
        actual: point.balance,
        baseline: point.baseline_balance,
      }))
  }, [result])

  const addLumpSum = (event: React.FormEvent) => {
    event.preventDefault()
    const month = Number(lumpMonth)
    const amount = Number(lumpAmount)
    if (!month || month < 1 || !amount) return
    onSettingsChange({
      mortgage_lump_sums: JSON.stringify([...lumpSums, { month, amount }]),
    })
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Mortgage</h2>
        <div className="controls">
          <SliderInput
            label="Amount owed"
            value={principal}
            onChange={(value) => onSettingsChange({ mortgage_principal: value })}
            min={25000}
            max={1000000}
            step={5000}
            format={money}
          />
          <SliderInput
            label="Interest rate"
            value={ratePct}
            onChange={(value) => onSettingsChange({ mortgage_rate_pct: value })}
            min={0}
            max={12}
            step={0.05}
            format={(value) => `${value}%`}
          />
          <SliderInput
            label="Term"
            value={termYears}
            onChange={(value) => onSettingsChange({ mortgage_term_years: value })}
            min={1}
            max={40}
            format={(value) => `${value} years`}
          />
          <SliderInput
            label="Monthly overpayment"
            value={overpayment}
            onChange={(value) => onSettingsChange({ mortgage_overpayment: value })}
            min={0}
            max={3000}
            step={25}
            format={money}
          />
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
                          onSettingsChange({
                            mortgage_lump_sums: JSON.stringify(
                              lumpSums.filter(
                                (item) =>
                                  !(item.month === lump.month && item.amount === lump.amount),
                              ),
                            ),
                          })
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
            onChange={(event) => onSettingsChange({ mortgage_lump_month: event.target.value })}
          />
          <input
            type="number"
            step="500"
            placeholder="Amount"
            value={lumpAmount}
            onChange={(event) => onSettingsChange({ mortgage_lump_amount: event.target.value })}
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
                  dataKey="baseline"
                  stroke={chartColor('mortgage-baseline', 0, colors)}
                  fill={chartColor('mortgage-baseline', 0, colors)}
                  fillOpacity={0.15}
                  name="Original plan"
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke={chartColor('mortgage-actual', 0, colors)}
                  fill={chartColor('mortgage-actual', 0, colors)}
                  fillOpacity={0.25}
                  name="With overpayments"
                />
              </AreaChart>
            </ResponsiveContainer>
          </section>
        </>
      )}
    </div>
  )
}
