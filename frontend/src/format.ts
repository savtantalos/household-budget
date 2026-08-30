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

type ChartValue = string | number | readonly (string | number)[] | undefined

/** Recharts hands tooltip formatters a loosely typed value. */
export const moneyTooltip = (value: ChartValue) => money(Number(value))
