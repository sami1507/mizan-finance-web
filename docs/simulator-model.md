# Test a decision — calculation specification

Model version: 1. Reviewed 2026-11-07. Engine: `src/lib/simulator.ts`.

## Purpose and scope

Compare a one-off purchase and an alternative daily spending allowance with the same baseline obligations. Results are conditional **daily closing balances**, not confirmed balances or a prediction of bank settlement. The screen supports 30, 60 or 90 days; the reusable engine accepts 1–90 days for independently verifiable examples. The clock uses the profile's time zone to choose today's calendar date. Calendar arithmetic then uses UTC noon, avoiding daylight-saving or time-zone date shifts.

The application serves people recording personal finances in manual bank, cash and wallet accounts. Its existing dashboard, reports and insights describe recorded transactions; this screen is a separate forward-looking sandbox. It uses the existing authenticated, owner-scoped PostgreSQL snapshot. No new third-party service, AI model, database migration or financial mutation is required.

## Inputs and sources

All money is an integer number of minor units: 100 agorot = ILS 1; 100 cents = USD/EUR 1. UI decimal strings are parsed exactly. No exchange rate is assumed.

| Symbol / input | Source | Unit and interpretation |
| --- | --- | --- |
| `a` | Profile time zone + current date | As-of calendar date; visible in the UI |
| `N` | User | Future calendar days, UI choices 30/60/90 |
| `C₀` | Financial accounts and recorded transactions dated ≤ `a` | Actual recorded pooled balance in one selected currency |
| `Iₜ`, `Eₜ` | Future recorded transactions and unprocessed active recurring occurrences | Income and expenses on calendar day `t`, counted once |
| `dᵦ`, `dₛ` | User, explicitly required; zero is allowed | Additional spending **per day**, outside the displayed events; baseline and proposed amounts |
| `P`, `p` | User | One purchase amount and date inside `[a, a+N]` |
| `G` | Goal contributions dated ≤ `a`, linked to goals of this currency | Existing earmarked money; zero if protection is switched off |
| `R` | User | Additional cash buffer, separate from `G`; default 0 is shown explicitly |
| Included schedules | User, default all active schedules in this currency | Exclusions affect this simulation only; never cancel an actual subscription |
| Processed occurrence keys | Owner-scoped database `processed_events` + transaction provenance | `recurring:<schedule-id>:<original-date>`; survives deletion of a recorded row |

The account snapshot's `balance` is deliberately **not** used as `C₀`: that field includes future-dated ledger entries. Instead:

`C₀ = Σ opening balances + Σ recorded income dated ≤ a − Σ recorded expense dated ≤ a`.

All accounts of a currency are pooled. Same-currency internal transfers therefore cancel exactly and are not added to either income or expenses. A pooled result cannot establish that a particular account has enough funds. The model assumes opening balances are valid anchors for the ledger, as in the rest of the application.

## Daily recurrence and double-counting rules

1. Future recorded rows enter on their own dates, once. Today's and earlier recorded rows are already included in `C₀`.
2. Expand active schedules using the application's existing weekly/monthly/yearly calendar rule. Month/year transitions clamp to the final valid day, and subsequent dates continue from that clamped date; e.g. January 31 → February 28 → March 28 in a non-leap year.
3. Skip an occurrence if either the durable processed-event set or any recorded row's provenance contains its key. Deleting a processed transaction and rewinding a schedule does not make that occurrence new again.
4. Unprocessed overdue occurrences are assumed outstanding and projected **today**. Their original dates remain visible in the events table and the overdue count is shown. Exclude a stale schedule from the simulation or correct it in Recurring when this assumption is wrong. More than 1,000 expanded occurrences per schedule is an explicit error, never silent truncation.
5. Matching manual/imported transaction and scheduled occurrence by account, category, kind, amount and original date is only a **possible** duplicate. The UI withholds results until the user excludes that schedule from the simulation or explicitly confirms these are separate payments. It never silently deletes or merges real records.
6. Repeated identical record IDs are counted once. Conflicting versions of one ID are rejected. Different transaction IDs remain distinct, even when their values match.
7. Historical averages, budget limits, transfers, and goal contributions are not added to projected expenses. The explicit daily allowance must exclude the listed events. No estimate is inferred from incomplete history. Future goal contributions are disclosed as excluded from the fixed reserve floor.

## Equations

Let day 0 be `a`. Let `Dᵦ,₀ = Dₛ,₀ = 0`, and for days `1…N`, `Dᵦ,ₜ = dᵦ`, `Dₛ,ₜ = dₛ`. Additional daily spending starts tomorrow; recorded spending through today is already in the opening balance.

Start `B₋₁ = S₋₁ = C₀`. For each closing day:

```text
Bₜ = Bₜ₋₁ + Iₜ − Eₜ − Dᵦ,ₜ
Sₜ = Sₜ₋₁ + Iₜ − Eₜ − Dₛ,ₜ − P × 1[t = p]
F  = G + R
Δₜ = Sₜ − Bₜ
```

`B` is baseline balance, `S` proposed balance, `F` the protected floor. Earmarking a goal changes the floor, **not** the balance. This prevents subtracting the same money twice.

For each path:

```text
Ending balance = closing balance on a + N
Minimum balance = min(all closing days, including day 0)
Minimum date = earliest date attaining that minimum
First floor breach = earliest t with closing balance < F, or none
Ending difference = proposed ending balance − baseline ending balance
Minimum difference = proposed minimum balance − baseline minimum balance
```

Higher ending balance, higher minimum balance, and a positive difference mean more money remains, **under these assumptions**. A floor breach is unfavorable; equality with the floor is allowed. The difference between minima is not necessarily the difference on either path's minimum date.

For the purchase ceiling, undo this proposed purchase, but retain the **proposed daily allowance**: `S⁰ₜ = Sₜ + P × 1[t ≥ p]`.

```text
Purchase ceiling = max(0, min(t ≥ p)(S⁰ₜ − F))
Pre-purchase breach = any t < p where S⁰ₜ < F
```

The ceiling applies only from the selected purchase date through the selected horizon. An earlier breach is reported separately; buying nothing cannot fix it. Zero ceiling does not imply the existing plan is healthy. Changing the date or horizon can change the ceiling, even with the same opening balance. It is not a spending authorization or a forecast beyond the shown period.

## Independently solved example

Currency ILS; as-of **7 November 2026**; horizon 30 days, through **7 December 2026**:

- Opening account 5,000 + recorded income 2,000 − recorded expense 300 = **6,700**.
- Future salary 2,000 on November 8; future rent 3,000 on November 9.
- Existing goal allocation 1,000 and additional buffer 500 → floor **1,500**.
- Baseline extra spending 100/day; proposed 80/day; purchase **5,000 on November 9**.

| Closing day | Baseline | Proposed | Difference |
| --- | ---: | ---: | ---: |
| Nov 7 | 6,700 | 6,700 | 0 |
| Nov 8 | 6,700 + 2,000 − 100 = 8,600 | 6,700 + 2,000 − 80 = 8,620 | +20 |
| Nov 9 | 8,600 − 3,000 − 100 = 5,500 | 8,620 − 3,000 − 80 − 5,000 = 540 | −4,960 |
| Dec 7 | 6,700 + 2,000 − 3,000 − 30×100 = **2,700** | 6,700 + 2,000 − 3,000 − 30×80 − 5,000 = **−1,700** | **−4,400** |

The baseline stays above 1,500. The proposed plan first breaches it on November 9. Both minima occur on December 7. The proposed plan without the purchase ends at 3,300, so the purchase ceiling is `3,300 − 1,500 = 1,800`. A purchase of exactly 1,800 ends at the floor; 1,800.01 breaches it by one agora. Unit tests independently assert every result above.

## Missing data, validation, precision and limits

- No accounts in the selected currency produces an empty state, not a fictional balance. No future income is disclosed; income is never invented. Blank required daily spending/purchase values withhold results. Explicit zero is valid.
- Money must be safe integers in minor units; individual input/ledger amounts are limited to `10¹²` minor units. Negative opening balances are supported; negative spending, purchase and buffers are rejected. NaN, Infinity and fractional minor units are invalid.
- Every sum uses BigInt and rejects a result outside JavaScript's safe integer range. No division, interest compounding, financial rounding or float multiplication occurs in the model. Number/currency formatting and chart coordinates are presentation only; the table preserves exact minor-unit results.
- Dates must be real dates between 1900 and 2199; the purchase must lie inside the selected horizon. Invalid/stale data produces a visible error instead of a partial forecast.
- Daily closing balances cannot establish intraday settlement order. No exchange rates, interest, inflation, credit limits, automatic tax, uncertain future income, future goal allocations, or account-specific liquidity are inferred.
- Assumptions exist in React state and reset on leaving/reloading, currency changes or refreshed financial data. They do not create transactions, update schedules, reserve money, or persist in localStorage. This is stated in the UI. Financial records continue to be stored in PostgreSQL.
- The pure engine runs in the browser over the authenticated snapshot. There is no new write endpoint or client-supplied owner ID. The existing server session and ownership checks govern all input data. Provenance keys are owner-scoped and read in the same repeatable-read database transaction as the ledger.

## Verification map

- `tests/simulator.test.ts`: independently calculated values, cent boundaries, invalid inputs, date boundaries, deduplication, currency isolation, goal protection, transformations and immutability.
- `tests/simulator.integration.test.ts`: actual database snapshots, processed-event provenance/tombstones and owner isolation.
- `tests/e2e/simulator.spec.ts`: authenticated browser flow, input changes, overlap review, Arabic/English, mobile/dark layout and unchanged stored data.

Research and candidate selection: [simulator-research.md](simulator-research.md).
