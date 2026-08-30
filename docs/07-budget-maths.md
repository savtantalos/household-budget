# 7. The budget maths

All of this lives in `backend/app/budget.py` as pure functions. Numbers below are your
seeded figures, so you can check them against the spreadsheet.

## 7.1 Normalise to monthly

```python
monthly(amount, frequency) = amount            if monthly
                             amount / 12       if yearly
                             0                 if one_off
```

Everything downstream works in £/month.

## 7.2 Pools

| Pool | Definition | Your numbers |
| --- | --- | --- |
| Income | sum of all income rows | 6,000 + 4,750 = **10,750** |
| Shared expenses | expense rows with `shared = true` | 3,000 + 400 + 93 + 201 + 45 + 58.35 = **3,797.35** |
| Personal expenses | `shared = false` | gym 368 + car 38 = **406** |
| Total expenses | shared + personal | **4,203.35** |
| Cash balance | income − total expenses | **6,546.65** |
| Spend ratio | expenses ÷ income | **39.1 %** |

## 7.3 Fair share

```
fair_share(person) = shared_expenses / number_of_people
                   = 3,797.35 / 2 = 1,898.675
```

Even split, matching the spreadsheet's "Individual Total House Exp". If you later want
to split *proportionally to income*, this single line is the only thing to change:
`share_i = shared_expenses * income_i / total_income`.

## 7.4 Settlement — who owes who

For each person:

```
settlement = paid_shared − fair_share − transfers_out + transfers_in
```

- `paid_shared` — what they actually paid towards shared bills,
- `transfers_out/in` — recurring person-to-person payments (your Barclays loan
  repayment of 778.62 from Georgia to Savvas).

Positive means the household owes them; negative means they owe.

| | Savvas | Georgia |
| --- | --- | --- |
| Paid into shared | 397.35 | 3,400.00 |
| − fair share | −1,898.675 | −1,898.675 |
| Transfers | +778.62 (in) | −778.62 (out) |
| **Settlement** | **−722.705** | **+722.705** |

The two always sum to zero, which is the built-in sanity check (asserted in the tests).
`_settle()` then turns the positions into instructions by matching debtors to
creditors largest-first:

> **Savvas pays Georgia £722.70**

With only two people there is always one line; the greedy algorithm generalises to
three or more housemates without changes.

## 7.5 What the month really costs each of you

```
true_cost = fair_share + paid_personal + transfers_out − transfers_in
remaining = income − true_cost
remaining_after_savings = remaining − monthly savings plan
```

| | Savvas | Georgia |
| --- | --- | --- |
| True cost | 1,898.675 + 406 − 778.62 = **1,526.06** | 1,898.675 + 778.62 = **2,677.30** |
| Remaining | 6,000 − 1,526.06 = **4,473.94** | 4,750 − 2,677.30 = **2,072.70** |
| Savings plan | 2,500 | 1,000 |
| Left after saving | **1,973.94** | **1,072.70** |

Note `remaining` is what is left *after settling up* — it already accounts for the
£722.70 Savvas sends Georgia, which is why it is the honest number to budget against.

## 7.6 Savings projection

```python
monthly_rate = (1 + annual_return_pct/100) ** (1/12) − 1
balance_{m}  = balance_{m−1} × (1 + monthly_rate) + monthly_contribution
```

Contributions are added at the end of each month (an *ordinary annuity*), and the rate
is the true monthly equivalent of the annual figure — not `annual/12`, which would
overstate growth.

The endpoint returns both the compounded `balance` and the plain `contributed` total,
so the chart can show what growth adds on top of what you put in.

Your seeded case: starting balance 88,009 (Barclays 55,259 + Revolut 1,750 + Georgia's
31,000), contributing 3,500/month.

| Years | 0 % return | 5 % return |
| --- | --- | --- |
| 5 | 298,009 | ≈ 350,600 |
| 10 | 508,009 | ≈ 686,700 |

Pass `person_id` to project one person's plan and accounts only.

## 7.7 Where the assumptions are

Deliberately explicit and easy to change:

| Assumption | Where | Change it to… |
| --- | --- | --- |
| Shared costs split evenly | `build_summary`, one line | split by income share |
| Yearly items ÷ 12 | `monthly()` | keep as lumps in a due month |
| Contributions at month end | `project_savings` | month start (annuity-due) |
| Transfers run forever | `Transfer.months_remaining` is stored but not applied | stop the transfer after N months |
