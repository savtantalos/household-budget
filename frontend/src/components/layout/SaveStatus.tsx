import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useBudgetContext } from '@/BudgetContext'
import { cn } from '@/lib/utils'

/**
 * A quiet pill in the top bar reflecting the settings store. Failures also raise a
 * toast with a Retry action so they are noticed wherever the user is.
 */
export function SaveStatus() {
  const { settings, settingsStatus, settingsError, retrySettings } = useBudgetContext()
  const toastId = useRef<string | number | null>(null)

  useEffect(() => {
    if (settingsStatus === 'error' && settingsError) {
      toastId.current = toast.error(
        settings ? 'Your changes have not been saved.' : 'Could not load your settings.',
        {
          id: toastId.current ?? undefined,
          description: settingsError,
          duration: Infinity,
          action: { label: 'Retry', onClick: () => void retrySettings() },
        },
      )
    } else if (toastId.current !== null) {
      toast.dismiss(toastId.current)
      toastId.current = null
    }
  }, [settingsStatus, settingsError, settings, retrySettings])

  if (settingsStatus === 'loading') return null

  const state = {
    saving: { icon: Loader2, label: 'Saving…', className: 'text-muted-foreground', spin: true },
    saved: { icon: Check, label: 'Saved', className: 'text-positive', spin: false },
    error: { icon: AlertCircle, label: 'Not saved', className: 'text-negative', spin: false },
  }[settingsStatus]

  return (
    <button
      type="button"
      role="status"
      onClick={settingsStatus === 'error' ? () => void retrySettings() : undefined}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-2.5 text-xs font-medium backdrop-blur transition-colors',
        settingsStatus === 'error' ? 'cursor-pointer hover:border-negative/60' : 'cursor-default',
        state.className,
      )}
    >
      <state.icon className={cn('size-3.5', state.spin && 'animate-spin')} />
      <span className="hidden sm:inline">{state.label}</span>
    </button>
  )
}
