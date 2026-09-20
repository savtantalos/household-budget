const currency = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 2,
})

const compact = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const money = (value: number) => currency.format(value)
export const moneyCompact = (value: number) => compact.format(value)
export const percent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`

/** "18 months" / "3y 4m" / "25 years" for a count of months. */
export const describeLife = (months: number) => {
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (!years) return `${rest} month${rest === 1 ? '' : 's'}`
  if (rest) return `${years}y ${rest}m`
  return `${years} year${years === 1 ? '' : 's'}`
}

type ChartValue = string | number | readonly (string | number)[] | undefined

/** Recharts hands tooltip formatters a loosely typed value. */
export const moneyTooltip = (value: ChartValue) => money(Number(value))

export const CHART_COLOR_PALETTE = [
  '#2f6fed',
  '#e0629b',
  '#28b487',
  '#f5a623',
  '#7c5cff',
  '#ff6b6b',
  '#00b8d9',
  '#9aa0a6',
]

export const DEFAULT_CHART_COLORS: Record<string, string> = {
  'savings-total': '#28b487',
  'savings-contributions': '#8898aa',
  'investment-total': '#28b487',
  'investment-contributions': '#8898aa',
  'mortgage-baseline': '#8898aa',
  'mortgage-actual': '#2f6fed',
  'invest-vs-overpay-invest': '#28b487',
  'invest-vs-overpay-overpay': '#2f6fed',
}

export function parseChartColors(
  settings?: { chart_colors: string } | null,
): Record<string, string> {
  try {
    return JSON.parse(settings?.chart_colors || '{}')
  } catch {
    return {}
  }
}

export function chartColor(
  key: string,
  index: number,
  colors: Record<string, string>,
): string {
  return (
    colors[key] ||
    DEFAULT_CHART_COLORS[key] ||
    CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length]
  )
}
