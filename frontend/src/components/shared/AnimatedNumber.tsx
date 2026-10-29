import { animate, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  value: number
  format?: (value: number) => string
  className?: string
}

/** Counts from the previous value to the next one; jumps straight there under reduced motion. */
export function AnimatedNumber({ value, format = String, className }: Props) {
  const motionValue = useMotionValue(value)
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(() => format(value))

  useEffect(() => {
    if (reduced) {
      motionValue.set(value)
      setDisplay(format(value))
      return
    }
    const controls = animate(motionValue, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(format(latest)),
      onComplete: () => setDisplay(format(value)),
    })
    return () => controls.stop()
  }, [value, format, motionValue, reduced])

  return <span className={cn('tabular', className)}>{display}</span>
}
