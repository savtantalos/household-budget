import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { chartColor, parseChartColors } from '../format'
import type { Account, Investment, SavingsPlan, Settings } from '../types'

interface Props {
  investments: Investment[]
  savingsPlans: SavingsPlan[]
  accounts: Account[]
}

interface SeriesItem {
  key: string
  label: string
  fallbackIndex: number
}

export function ColoursPanel({ investments, savingsPlans, accounts }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    void api.settings().then(setSettings)
  }, [])

  const colors = useMemo(() => parseChartColors(settings), [settings])

  const series = useMemo<SeriesItem[]>(() => {
    const list: SeriesItem[] = [
      { key: 'savings-total', label: 'Savings: Total', fallbackIndex: 0 },
      {
        key: 'savings-contributions',
        label: 'Savings: Contributions only',
        fallbackIndex: 1,
      },
    ]
    savingsPlans.forEach((plan, index) =>
      list.push({
        key: `plan-${plan.id}`,
        label: `Savings plan: ${plan.label}`,
        fallbackIndex: index,
      }),
    )
    accounts.forEach((account, index) =>
      list.push({
        key: `account-${account.id}`,
        label: `Account: ${account.institution}`,
        fallbackIndex: index,
      }),
    )
    list.push(
      { key: 'investment-total', label: 'Investments: Total', fallbackIndex: 0 },
      {
        key: 'investment-contributions',
        label: 'Investments: Contributions only',
        fallbackIndex: 1,
      },
    )
    investments.forEach((inv, index) =>
      list.push({
        key: `investment-${inv.id}`,
        label: `Investment: ${inv.name}`,
        fallbackIndex: index,
      }),
    )
    list.push(
      { key: 'mortgage-baseline', label: 'Mortgage: Original plan', fallbackIndex: 0 },
      {
        key: 'mortgage-actual',
        label: 'Mortgage: With overpayments',
        fallbackIndex: 1,
      },
      {
        key: 'invest-vs-overpay-invest',
        label: 'Invest vs overpay: Invest',
        fallbackIndex: 0,
      },
      {
        key: 'invest-vs-overpay-overpay',
        label: 'Invest vs overpay: Overpay mortgage',
        fallbackIndex: 1,
      },
    )
    return list
  }, [investments, savingsPlans, accounts])

  const updateColor = (key: string, value: string) => {
    const next = { ...colors, [key]: value }
    void api.updateSettings({ chart_colors: JSON.stringify(next) }).then(setSettings)
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Chart colours</h2>
        <p className="muted">Choose a colour for each line and area on the charts.</p>
        <table>
          <thead>
            <tr>
              <th>Series</th>
              <th>Colour</th>
            </tr>
          </thead>
          <tbody>
            {series.map((item) => (
              <tr key={item.key}>
                <td>
                  <label htmlFor={`colour-${item.key}`}>{item.label}</label>
                </td>
                <td>
                  <input
                    id={`colour-${item.key}`}
                    type="color"
                    value={chartColor(item.key, item.fallbackIndex, colors)}
                    onChange={(event) => updateColor(item.key, event.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
