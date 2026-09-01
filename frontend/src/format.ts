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
