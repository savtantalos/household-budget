import type {
  Account,
  Expense,
  Income,
  Mortgage,
  MortgageInput,
  Person,
  Projection,
  SavingsPlan,
  Summary,
  Transfer,
} from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`${response.status} ${response.statusText}: ${detail}`)
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

interface Resource<T> {
  list: () => Promise<T[]>
  create: (payload: Partial<T>) => Promise<T>
  update: (id: number, payload: Partial<T>) => Promise<T>
  remove: (id: number) => Promise<void>
}

function resource<T>(path: string): Resource<T> {
  return {
    list: () => request<T[]>(path),
    create: (payload) =>
      request<T>(path, { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) =>
      request<T>(`${path}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    remove: (id) => request<void>(`${path}/${id}`, { method: 'DELETE' }),
  }
}

export const api = {
  people: resource<Person>('/people'),
  incomes: resource<Income>('/incomes'),
  expenses: resource<Expense>('/expenses'),
  transfers: resource<Transfer>('/transfers'),
  savingsPlans: resource<SavingsPlan>('/savings-plans'),
  accounts: resource<Account>('/accounts'),
  summary: () => request<Summary>('/summary'),
  projection: (years: number, annualReturnPct: number) =>
    request<Projection>(`/projection?years=${years}&annual_return_pct=${annualReturnPct}`),
  mortgage: (input: MortgageInput) =>
    request<Mortgage>('/mortgage', { method: 'POST', body: JSON.stringify(input) }),
}
