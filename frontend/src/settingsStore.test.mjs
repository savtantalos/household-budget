import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSettingsStore } from './settingsStore.ts'

const defaults = {
  savings_years: 5,
  savings_annual_return_pct: 5,
  investment_projection_years: 10,
  mortgage_principal: 300000,
  mortgage_rate_pct: 4.5,
  mortgage_term_years: 25,
  mortgage_overpayment: 0,
  mortgage_lump_sums: '[]',
  mortgage_lump_month: '12',
  mortgage_lump_amount: '10000',
  invest_principal: 300000,
  invest_mortgage_rate_pct: 4.5,
  invest_term_years: 25,
  invest_monthly_amount: 500,
  invest_annual_return_pct: 7,
  chart_colors: '{}',
  split_mode: 'even',
  theme: 'system',
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const tick = () => new Promise((resolve) => setImmediate(resolve))

test('loads saved values without writing defaults and deduplicates initial loads', async () => {
  let loads = 0
  let writes = 0
  const store = createSettingsStore(async () => {
    loads += 1
    return { ...defaults, savings_years: 17, savings_annual_return_pct: 0 }
  }, async () => { writes += 1; return defaults })
  await Promise.all([store.load(), store.load()])
  assert.equal(loads, 1)
  assert.equal(writes, 0)
  assert.equal(store.getSnapshot().settings.savings_years, 17)
  assert.equal(store.getSnapshot().settings.savings_annual_return_pct, 0)
  assert.equal(store.getSnapshot().status, 'saved')
})

test('saves immediately and survives a panel unsubscribing before the response', async () => {
  const response = deferred()
  const calls = []
  const store = createSettingsStore(async () => defaults, (patch) => {
    calls.push(patch)
    return response.promise
  })
  await store.load()
  const unsubscribe = store.subscribe(() => {})
  store.update({ savings_years: 15, savings_annual_return_pct: 8 })
  unsubscribe()
  assert.deepEqual(calls, [{ savings_years: 15, savings_annual_return_pct: 8 }])
  assert.equal(store.getSnapshot().settings.savings_years, 15)
  assert.equal(store.getSnapshot().status, 'saving')
  response.resolve({ ...defaults, ...calls[0] })
  await tick()
  assert.equal(store.getSnapshot().status, 'saved')
  assert.equal(store.getSnapshot().settings.savings_annual_return_pct, 8)
})

test('serializes rapid edits and merges pending changes across charts', async () => {
  const first = deferred()
  const calls = []
  let database = { ...defaults }
  const store = createSettingsStore(async () => database, async (patch) => {
    calls.push(patch)
    if (calls.length === 1) await first.promise
    database = { ...database, ...patch }
    return database
  })
  await store.load()
  store.update({ savings_years: 6 })
  store.update({ savings_years: 7 })
  store.update({ savings_years: 20, investment_projection_years: 30 })
  store.update({ mortgage_overpayment: 500, invest_monthly_amount: 1000 })
  assert.equal(calls.length, 1)
  assert.equal(store.getSnapshot().settings.savings_years, 20)
  first.resolve()
  await tick()
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[1], {
    savings_years: 20, investment_projection_years: 30,
    mortgage_overpayment: 500, invest_monthly_amount: 1000,
  })
  assert.equal(store.getSnapshot().status, 'saved')
  assert.equal(database.savings_years, 20)
  assert.equal(database.investment_projection_years, 30)
  const reloaded = createSettingsStore(async () => database, async () => database)
  await reloaded.load()
  assert.deepEqual(reloaded.getSnapshot().settings, store.getSnapshot().settings)
})

test('retains failed edits, exposes an error, and retries the latest values', async () => {
  const first = deferred()
  const calls = []
  const store = createSettingsStore(async () => defaults, (patch) => {
    calls.push(patch)
    return calls.length === 1 ? first.promise : Promise.resolve({ ...defaults, ...patch })
  })
  await store.load()
  store.update({ savings_years: 12, savings_annual_return_pct: 0 })
  store.update({ savings_years: 13 })
  first.reject(new Error('Offline'))
  await tick()
  assert.equal(store.getSnapshot().status, 'error')
  assert.equal(store.getSnapshot().error, 'Offline')
  assert.equal(store.getSnapshot().settings.savings_years, 13)
  await store.retry()
  assert.deepEqual(calls[1], { savings_years: 13, savings_annual_return_pct: 0 })
  assert.equal(store.getSnapshot().status, 'saved')
  assert.equal(store.getSnapshot().error, null)
})

test('failed loading never writes defaults and can be retried', async () => {
  let attempts = 0
  let writes = 0
  const store = createSettingsStore(async () => {
    if (++attempts === 1) throw new Error('Load failed')
    return defaults
  }, async () => { writes += 1; return defaults })
  await store.load()
  assert.equal(store.getSnapshot().settings, null)
  assert.equal(store.getSnapshot().status, 'error')
  store.update({ savings_years: 20 })
  assert.equal(writes, 0)
  await store.retry()
  assert.equal(store.getSnapshot().status, 'saved')
  assert.equal(store.getSnapshot().settings.savings_years, 5)
})

test('independent sessions do not share settings and unchanged values are not saved', async () => {
  let writes = 0
  const first = createSettingsStore(async () => defaults, async (patch) => {
    writes += 1
    return { ...defaults, ...patch }
  })
  const second = createSettingsStore(async () => defaults, async () => defaults)
  await Promise.all([first.load(), second.load()])
  first.update({ savings_years: 5 })
  assert.equal(writes, 0)
  first.update({ savings_years: 25 })
  await tick()
  assert.equal(writes, 1)
  assert.equal(second.getSnapshot().settings.savings_years, 5)
})
