import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AnimatedNumber } from './AnimatedNumber'

export type Tone = 'neutral' | 'positive' | 'negative' | 'warning'

interface Props {
  label: string
  value: number
  format: (value: number) => string
  hint?: React.ReactNode
  tone?: Tone
  icon?: LucideIcon
  /** Highlights the card with the brand gradient; use for the single most important figure. */
  featured?: boolean
  className?: string
}

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-foreground',
  positive: 'text-positive',
  negative: 'text-negative',
  warning: 'text-warning',
}

const TONE_ICON: Record<Tone, string> = {
  neutral: 'bg-primary/10 text-primary',
  positive: 'bg-positive/12 text-positive',
  negative: 'bg-negative/12 text-negative',
  warning: 'bg-warning/15 text-warning',
}

export function StatCard({
  label,
  value,
  format,
  hint,
  tone = 'neutral',
  icon: Icon,
  featured = false,
  className,
}: Props) {
  return (
    <Card
      size="sm"
      className={cn(
        'group relative gap-2 px-4 py-4 shadow-card ring-border/60 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-raised',
        featured && 'surface-gradient',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        {Icon && (
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-md',
              TONE_ICON[tone],
            )}
          >
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <AnimatedNumber
        value={value}
        format={format}
        className={cn('text-2xl font-semibold tracking-tight', TONE_TEXT[tone])}
      />
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  )
}
