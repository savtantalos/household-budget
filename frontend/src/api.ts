import type {
  Account,
  AuthToken,
  Category,
  Comparison,
  ComparisonInput,
  Expense,
  Income,
  Investment,
  Mortgage,
  MortgageInput,
  Person,
  Projection,
  SavingsPlan,
  Settings,
  Summary,
  Transfer,
  User,
} from './types'

function token() {
  return localStorage.getItem('budget-token')
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const t = token()
  if (t) {
    headers.Authorization = `Bearer ${t}`
  }
  const response = await fetch(`/api${path}`, {
    headers,
    ...init,
  })
  if (response.status === 401) {
    localStorage.removeItem('budget-token')
    throw new Error('401 Unauthorized: please log in again')
  }
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
  login: (email: string, password: string) =>
    request<AuthToken>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    request<AuthToken>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>('/auth/me'),
  categories: resource<Category>('/categories'),
  people: resource<Person>('/people'),
  incomes: resource<Income>('/incomes'),
  expenses: resource<Expense>('/expenses'),
  transfers: resource<Transfer>('/transfers'),
  savingsPlans: resource<SavingsPlan>('/savings-plans'),
  accounts: resource<Account>('/accounts'),
  investments: resource<Investment>('/investments'),
  summary: () => request<Summary>('/summary'),
  settings: () => request<Settings>('/settings'),
  updateSettings: (payload: Partial<Settings>) =>
    request<Settings>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  projection: (years: number, annualReturnPct: number) =>
    request<Projection>(`/projection?years=${years}&annual_return_pct=${annualReturnPct}`),
  mortgage: (input: MortgageInput) =>
    request<Mortgage>('/mortgage', { method: 'POST', body: JSON.stringify(input) }),
  investmentProjection: (years: number) =>
    request<Projection>(`/investment-projection?years=${years}`),
  investVsOverpay: (input: ComparisonInput) =>
    request<Comparison>('/invest-vs-overpay', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
}
