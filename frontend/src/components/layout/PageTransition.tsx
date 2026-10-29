import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useLocation } from 'react-router'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const reduced = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="flex-1"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
