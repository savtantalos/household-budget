import { money } from '@/format'

/** Theme-aware series colours; index wraps around the eight chart tokens. */
export const chartToken = (index: number) => `var(--chart-${(index % 8) + 1})`

/** Shared axis styling so every chart reads the same. */
export const AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const

export const GRID_PROPS = {
  strokeDasharray: '3 3',
  vertical: false,
  stroke: 'var(--border)',
} as const

/** A vertical fade for area/bar fills. Reference it with `fill="url(#id)"`. */
export function ChartGradient({
  id,
  color,
  from = 0.45,
  to = 0.02,
}: {
  id: string
  color: string
  from?: number
  to?: number
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={from} />
      <stop offset="100%" stopColor={color} stopOpacity={to} />
    </linearGradient>
  )
}

/** Tooltip row renderer for money series: name on the left, formatted value on the right. */
export function moneyTooltipRow(
  value: number | string | readonly (number | string)[] | undefined,
  name: number | string,
  item: { color?: string; payload?: { fill?: string } },
) {
  const colour = item.payload?.fill ?? item.color
  return (
    <div className="flex w-full items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: colour }} />
      <span className="text-muted-foreground">{name}</span>
      <span className="ml-auto font-medium text-foreground tabular">{money(Number(value))}</span>
    </div>
  )
}
