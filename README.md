# fina

Personal money log for one person. Next.js (App Router) + Firebase + Vercel.
Replaces `Budget.numbers` + iOS Shortcuts.

Plan and the reasoning behind every decision: [`roadmap/`](roadmap/).

| | |
|---|---|
| Live | https://fina.kyphan38.com |
| Firebase project | `kyphan38-fina-app`, database `(default)` |
| Access | one email, `ALLOWED_USER_EMAIL` |
| Session | httpOnly cookie `fina_session`, 14 days |
| Money | integer VND in the database, typed and shown in thousands |
| Fonts | system stack only, no web font |

---

## The two numbers, and the third that is not one of them

This is the thing to understand first; everything else follows.

| | What it is | Where you change it | What it touches |
|---|---|---|---|
| **Standard** | your normal amount for a bucket | Settings | opens each new cycle, fills the Generator |
| **Limit** | what *this* cycle allows | Generator → Apply, or Summary → Edit limits | this cycle only |
| Fund balance | money actually sitting in a fund | nothing sets it directly | derived from records |

A limit is **frozen when the cycle opens**. Editing a Standard in Settings can
never change a number you already looked at last month - if it could, two
readings of the same chart would disagree and neither would be wrong.

There used to be a third name, `Baseline`, sitting between Standard and Limit.
It did nothing Standard did not already do, and was removed. See
`roadmap/AMENDMENT-limits-and-standards.md`.

## How money gets into a fund

Through a **transaction**, never an invisible addition.

Applying the Generator on the 25th does three things in one batch: records the
salary as an income entry, freezes the limits, and pays each BIDV fund an
inbound transaction tagged `source: 'allocation'`.

For six weeks it did none of that. Funds only ever decreased, so Travel - which
receives 2.000 a month - would have shown deep red after a year.
`recompute-balances` is the check: it rebuilds every balance from the records
and must report **`Moi so du deu khop`**.

Because the money arrives as a record, opening balances have to be records too.
Anything else means a dong in a fund that traces back to nothing, and the
recompute script would delete it.

## Why income has its own collection

`income/` is separate from `transactions/`, and there is a bug on the record
explaining why. History's total once *subtracted* ETF deposits: the refund
feature made every inbound transaction reduce spending, and a deposit is
inbound. September read 415 against 3.840 actually spent.

Anything that is not spending, sharing a collection with spending, means every
sum has to remember to exclude it. One day one of them will not. Income sits
further from spending than a deposit does.

The three exclusions that make `Out` correct - allocations, ETF, and refunds
subtracting - live in one pure function in `src/lib/cashflow.ts` with tests,
and both Summary and History read it. Two places computing spending two ways
are two places that will disagree.

## Cycles cut on the 25th

A cycle is named for the month it *ends* in: `2026-10` runs 25 Sep → 24 Oct.
Spending on 25 Aug belongs to `2026-09`.

`25 Dec 2026` lands in `2027-01`. That is the case a naive implementation gets
wrong, and it has its own test.

Cycles that predate the app carry `limits: {}`. We do not know what the old
limits were, and copying today's backwards would make the first six months of
charts quietly fictional.

## Firestore reads

Free tier is 50k/day. Every screen drops its listeners on unmount.

| Screen | Docs per open |
|---|---|
| Log | buckets 12 + cycle transactions ~30 + cycle 1 + covers ~2 ≈ **45** |
| Summary | the above + income ~2 ≈ **47** |
| History | buckets 12 + transactions ~30 + cycle list ~3 ≈ **45** |
| Insights | buckets 12 + cycle docs ~3 + current cycle ~32 ≈ **47** |

A normal day - app opened ~15 times, mostly to log - is roughly **1.000 reads,
2% of the tier**. Over 20k a day means a listener is leaking: check that every
new hook returns its unsubscribe.

Insights deliberately reads *cycle documents*, not transactions. `closedTotals`
is snapshotted at close so six cycles of trend cost six reads rather than
several thousand.

## Backup

Firestore does not back this up for you. Export is the whole safety net.

**Export.** Settings → Export JSON (everything) or CSV (transactions, with
`Cycle | Month | Year` columns generated at export time). A reminder appears in
Settings once it has been 35 days.

**Restore.** `/settings/restore` - no link points at it. Pick the file, read the
preview, type `RESTORE`. It **only adds records that are missing**, matched by
id. It never overwrites and never deletes, so running it twice is safe.

A restore that faithfully returned the file's state would erase everything
logged since the export. That is how backups lose data rather than save it.

## Reminders

A push at 22:00 after **two quiet days** - two rather than one because only 43
of 159 days in the real history carry an entry. A daily nudge would fire around
266 times a year, mostly on days with genuinely nothing to log, and would be
switched off inside a fortnight.

Setting it up, once:

1. Firebase Console → upgrade to **Blaze**. Both scheduled jobs sit inside
   Cloud Scheduler's free tier.
2. Console → Project settings → Cloud Messaging → **Web Push certificates** →
   generate. Put the key in `.env.local` and Vercel as
   `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
3. `cd functions && npm install && cd .. && firebase deploy --only functions`
4. On the iPhone: open the site **in Safari**, Share → Add to Home Screen. Open
   it from that icon, then Settings → Turn on.

iOS only delivers web push to an installed app, so `/settings` says "not
installed" in a normal browser tab. That is correct, not a bug.

**To stop paying:**

```bash
firebase functions:delete pushReminders trimPushLog
```

Then drop back to Spark. The app keeps working; you lose lock-screen reminders.

---

## Edge cases you should know

**A refund belongs to the cycle of its own date.** Front 1.500 for a group trip
in September and get 1.000 back in October, and September keeps the 1.500 while
October shows the refund. Everything in the app routes through
`cycleOf(occurredAt)`, and a second rule here would be one more thing to rot.
To force it into the earlier cycle, edit the refund's date - manual, and visible.

**Covers do not cancel themselves when money comes back.** A BIDV cover may
already have moved real money, and undoing it silently would put the app at odds
with the bank. Undo is a button. Undoing a completed cover *does* return the
balance to its fund.

**Buffer resets every cycle,** so no debt accumulates across months. That was a
deliberate choice; the six-cycle chart in Insights is what replaces the running
total for spotting a pattern.

**Overspending a fund leaves it negative until covered.** That is the true
state: the money is gone and nothing has replaced it yet.

**A transaction is always saved before the cover sheet opens.** Blocking the
save first differs in exactly one situation and it is the bad one - standing at
a counter, the sheet appears, the phone gets locked, and the entry never existed.

**Opening balances are outside cash flow.** They carry `source: 'opening'` and
stay out of In, Out, Invested and allocated, while still counting toward fund
balances. Tagged as allocations they once made a pseudo-cycle report
`Invested 177.714` against `In 0`.

**Hours-equivalent: nothing is ever split across cycles.** A transaction belongs
whole to the cycle of its `occurredAt`.

---

## Security review — 2026-09-02

| # | Check | Result |
|---|---|---|
| 1 | No secret in git history | **Pass** — only the `*firebase-adminsdk*.json` pattern in `.gitignore` and a mention in a roadmap doc. No key, no private key |
| 2 | No secret in a `NEXT_PUBLIC_*` var | **Pass** — Firebase web config and the VAPID public key, both public by design |
| 3 | Rules deny unauthenticated reads | **Pass** — `buckets`, `transactions`, `income` all return `403 PERMISSION_DENIED` over the REST API |
| 4 | Auth route rejects bad input | **Pass** — no token 400, garbage token 401. `GET` returns `{authenticated:false}` by design; it is a status probe and leaks nothing |
| 5 | Rate limit on `/api/insight` | **N/A** — the route does not exist yet. Required before Stage 7's AI half ships |
| 6 | Allowlist blocks other emails | **Pass** — checked in `api/auth/session` when trading the token, and again in `server-auth` on every server-side read |
| 7 | Cookie `httpOnly` + `secure` + `sameSite: lax` | **Pass** — `secure` in production only, so localhost still works |
| 8 | No personal data in production logs | **Pass** — one `console.warn` about the Firestore cache, and the function logs `error.name` plus a uid. No amounts, no notes |
| 9 | Firebase Console → Authorized domains | **Manual — check this yourself.** A script cannot |
| 10 | Rules reject a non-integer amount | **Pass** — `isVnd()` requires `is int && >= 0`; typing `25.5` into a raw write is refused at the database |
| 11 | Own Firebase project | **Pass** — `kyphan38-fina-app`, `(default)`. `logi`, `cogi` and `noda` each have their own |

Item 9 is the only one a script cannot check. Open Firebase Console → Auth →
Settings → Authorized domains and remove anything that is not the real domain
or `localhost`.

---

## Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm test

firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
```

Scripts run through an alias hook so they use the app's own code rather than a
second copy:

```bash
node --import ./scripts/register.mjs --env-file=.env.local scripts/<name>.mjs --uid <UID>
```

| Script | What it does |
|---|---|
| `apply-standards.mjs` | Push `SEED_BUCKETS` onto existing buckets |
| `import-numbers.mjs` | Import a `Budget.numbers` CSV export. Stops on any row no rule covers |
| `recompute-balances.mjs` | Rebuild fund balances from records and report drift |
| `backfill-cycle-totals.mjs` | Snapshot totals onto cycles closed before snapshots existed |
| `make-icons.mjs` | Generate PWA icons from `public/branding/fina-icon.svg` |
| `seed-testdata.mjs` | **Wipes and rewrites test data.** Needs `--i-know-this-wipes-everything` |

All of them are dry-run by default; `--commit` writes.

---

## Stage log

| Stage | Status | Date |
|---|---|---|
| 1 — Foundation & Auth | done | 2026-09-02 |
| 2 — Buckets & Quick Log | done | 2026-09-02 |
| 3 — Summary & Cycle | done | 2026-09-02 |
| 4 — History, Edit & Import | done, import not yet run on real data | 2026-09-02 |
| 5 — Overspend & Cover | done | 2026-09-02 |
| 6 — PWA & Reminder | done, deployed | 2026-09-02 |
| 7 — Insights | charts done; written notes wait for three closed cycles | 2026-09-02 |
| 8 — Mac layout & handover | debts paid, Mac layout done, this review done | 2026-09-02 |

Remaining before real use: measure cold start in the installed PWA, import the
138 real rows, and run beside `Budget.numbers` for a full cycle. See
`roadmap/STAGE-8-DETAILED.md`.

### Traps that cost a round trip

Each of these passed locally and failed only in production or on the phone.

- **`4.1 * 1_000_000` is `4099999.9999999995`.** Rules require an integer, a
  batch is all-or-nothing, and twelve buckets appeared then vanished with no
  error shown. Seed amounts are integer literals now, with a test.
- **`jose` 6 is ESM-only** and `jwks-rsa`, via firebase-admin, still `require()`s
  it. Every server route 500s on Vercel without the pin in `overrides`. Dev and
  `next build` both pass regardless.
- **The app's tsconfig swept in `functions/src`,** whose dependencies Vercel
  never installs. Passed here because that folder exists locally.
- **`toTx()` mapped any unknown `source` to `'web'`,** so allocations counted as
  spending — and being inbound, they *subtracted*. Cash flow read `Left` larger
  than `In`.
- **Startup was measured to the first keypad tap,** which recorded how long
  someone took to decide to type: one reading was 28 seconds. Measuring to the
  painted keypad still gave 82s, because iOS wakes a suspended PWA without a new
  navigation. Only runs where the page stayed visible are recorded now.
