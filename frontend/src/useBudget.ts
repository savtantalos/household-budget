import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import type { Account, Expense, Income, Person, SavingsPlan, Summary, Transfer } from './types'

export interface BudgetData {
  people: Person[]
  incomes: Income[]
  expenses: Expense[]
  transfers: Transfer[]
  savingsPlans: SavingsPlan[]
  accounts: Account[]
  summary: Summary
}

export function useBudget() {
  const [data, setData] = useState<BudgetData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [people, incomes, expenses, transfers, savingsPlans, accounts, summary] =
        await Promise.all([
          api.people.list(),
          api.incomes.list(),
          api.expenses.list(),
          api.transfers.list(),
          api.savingsPlans.list(),
          api.accounts.list(),
          api.summary(),
        ])
      setData({ people, incomes, expenses, transfers, savingsPlans, accounts, summary })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budget')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, error, loading, refresh }
}
