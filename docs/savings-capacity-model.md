# Monthly savings capacity

This is a deterministic monthly arithmetic calculator. It does not forecast future balances, recommend an investment, move money, or write to the database. It answers how much of the entered monthly income remains after entered expenses, and how a separate reserve affects that amount.

## Manual calculation

`calculateSavingsCapacity({ income, expenses: [{ id, amount }], reserve })` accepts nonnegative safe integers in minor units (agorot/cents). Expense IDs must be nonempty and unique. Zero income, zero expenses and a zero reserve are valid. Each total must remain within JavaScript's safe integer range; invalid inputs and overflowing totals raise `SavingsCapacityError` with a stable code. Arithmetic and ratio rounding use `BigInt` internally.

| Output | Definition |
| --- | --- |
| `expenseTotal` | Sum of the itemized expenses |
| `net` | Income minus expenses; may be negative |
| `maximumSavings` | `max(net, 0)` |
| `deficit` | `max(-net, 0)` |
| `afterReserve` | `max(net - reserve, 0)` |
| `reserveShortfall` | `max(reserve - maximumSavings, 0)` |
| `savingsRateBasisPoints` | `maximumSavings / income × 10,000`, rounded half-up; `null` when income is zero |

The reserve is a separate allocation, not an additional expense. Savings rate describes the maximum before that reserve: 3,750 basis points means 37.5%. A deficit remains visible rather than being represented as negative savings.

Example in major units: income 8,000 minus expenses 5,000 gives maximum savings 3,000 and a 37.5% rate. A reserve of 500 leaves 2,500 after reserve. If expenses exceed income, maximum savings and after-reserve funds are zero while the deficit and reserve shortfall are shown separately.

## Importing a recorded month

`recordedMonthlySavings(snapshot, month, currency)` reads a full calendar month (`YYYY-MM`, years 1900–2199) from the snapshot already scoped to the signed-in user by the server. It is not an authentication boundary. It returns income, expense total, transaction counts and expense groups with stable category IDs. Those groups can feed the manual calculator; their labels come from the application's category translations.

Only persisted income/expense rows in the selected currency and month are included. This includes future-dated recorded entries within that month. There is no implicit current-day cutoff, annualization, currency conversion or inferred spending. Account balances, opening balances, internal transfers, budgets, goals, contributions and unrecorded recurring schedules do not enter these totals. A recurring occurrence already recorded as a transaction is counted normally.

For included rows, the helper validates the real calendar date (including February and leap years), unique transaction ID, strictly positive safe amount, account membership/currency, and category membership/kind. Repeated transaction IDs are rejected even if their contents are identical. An unknown account on an otherwise matching row is an error, not a silently omitted expense.

Other currencies and recognizable other months are out of scope and are not validated as part of this calculation. A malformed date with no recognizable month in the selected currency fails explicitly because it cannot be assigned safely to a period. Empty months return zero totals and no groups. Expense groups are sorted deterministically by category ID; input snapshots and inputs are never changed.

The result is only as complete as the entered or recorded income and expenses. “Maximum savings” is the arithmetic remainder for that month, not a guarantee that money is available in a particular account or on a particular day.
