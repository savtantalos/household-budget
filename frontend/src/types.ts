export type Frequency = 'monthly' | 'yearly' | 'one_off'

export interface Person {
  id: number
  name: string
  colour: string
}

export interface Income {
  id: number
  person_id: number
  label: string
  amount: number
  frequency: Frequency
}

export interface Expense {
  id: number
  payer_id: number
  label: string
  amount: number
  category: string
  due_day: number | null
  shared: boolean
  frequency: Frequency
}

export interface Transfer {
  id: number
  from_person_id: number
  to_person_id: number
  label: string
  amount: number
  months_remaining: number | null
}

export interface SavingsPlan {
  id: number
  person_id: number
  label: string
  monthly_amount: number
}

export interface Account {
  id: number
  person_id: number
  institution: string
  balance: number
  as_of: string
}

export interface PersonSummary {
  id: number
  name: string
  income: number
  paid_shared: number
  paid_personal: number
  fair_share: number
  transfers_out: number
  transfers_in: number
  savings: number
  net_worth: number
  settlement: number
  true_cost: number
  remaining: number
  remaining_after_savings: number
}

export interface Settlement {
  from_person: string
  to_person: string
  amount: number
}

export interface Summary {
  people: PersonSummary[]
  settlements: Settlement[]
  total_income: number
  total_expenses: number
  shared_expenses: number
  personal_expenses: number
  total_savings: number
  net_worth: number
  cash_balance: number
  spend_ratio: number
}

export interface ProjectionPoint {
  month: number
  year: number
  contributed: number
  balance: number
}

export interface Projection {
  starting_balance: number
  monthly_contribution: number
  annual_return_pct: number
  points: ProjectionPoint[]
}
