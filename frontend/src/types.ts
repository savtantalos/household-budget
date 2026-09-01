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

export interface Investment {
  id: number
  person_id: number
  name: string
  category: string
  balance: number
  monthly_contribution: number
  annual_return_pct: number
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

export interface LumpSum {
  month: number
  amount: number
}

export interface MortgageInput {
  principal: number
  annual_rate_pct: number
  term_years: number
  monthly_overpayment: number
  lump_sums: LumpSum[]
}

export interface MortgagePoint {
  month: number
  year: number
  balance: number
  interest_paid: number
  principal_paid: number
  baseline_balance: number
}

export interface Mortgage {
  monthly_payment: number
  months_to_repay: number
  total_interest: number
  total_paid: number
  baseline_months_to_repay: number
  baseline_total_interest: number
  interest_saved: number
  months_saved: number
  points: MortgagePoint[]
}

export interface ComparisonInput {
  principal: number
  annual_rate_pct: number
  term_years: number
  monthly_amount: number
  annual_return_pct: number
}

export interface ComparisonPoint {
  month: number
  year: number
  invest_wealth: number
  overpay_wealth: number
}

export interface Comparison {
  monthly_payment: number
  invest_final_pot: number
  invest_total_interest: number
  overpay_months_to_repay: number
  overpay_final_pot: number
  overpay_total_interest: number
  winner: string
  advantage: number
  points: ComparisonPoint[]
}
