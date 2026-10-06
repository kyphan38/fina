// ============================================================
// fina - Data model
//
// Invariants (roadmap/ROADMAP.md):
//  - Money is ALWAYS integer VND. The UI types/shows thousands.
//  - Only two bucket kinds: budget (resets each cycle) and fund (accumulates).
//  - The cycle turns on the 25th.
// ============================================================

export const CYCLE_START_DAY = 25;
export const TIMEZONE = 'Asia/Ho_Chi_Minh';
export const REMINDER_HOUR = 22;
export const REMINDER_QUIET_DAYS = 2;

export type BucketKind = 'budget' | 'fund';

/**
 * State of a goal (a fund saved up for one big purchase, see PLAN-goals.md).
 *  - saving: saving now, gets money on day 25
 *  - later:  just an idea, gets nothing yet
 *  - done:   bought
 */
export type GoalStatus = 'saving' | 'later' | 'done';

export interface Goal {
  /** Target price. null = not known yet. */
  targetVnd: number | null;
  /** Month to buy, '2027-04'. null = no date yet. */
  targetMonth: string | null;
  status: GoalStatus;
}
export type Bank = 'VCB' | 'BIDV' | 'VPS';

/** Firestore: users/{uid}/buckets/{bucketId} */
export interface Bucket {
  id: string;
  name: string;
  kind: BucketKind;
  bank: Bank;
  /**
   * The standard amount. Rarely changes. Used for two things:
   *  - the default when a new cycle OPENS
   *  - prefilling the Generator
   * Never flows into the running cycle by itself.
   */
  standardVnd: number;
  /** What this bucket covers. Shown when selected, hidden once typing starts. */
  hint: string | null;
  /**
   * Only for kind='fund'. Denormalized so the app does not re-add all history
   * on each open. Can go negative on overspend. Rebuildable with
   * scripts/recompute-balances.mjs.
   */
  balanceVnd: number;
  /** Order in the grid. Fixed - never auto-sorted by frequency. */
  order: number;
  active: boolean;
  /**
   * Spent evenly through the month, or in lumps.
   *
   * Only "even" buckets compare with a linear pace. Health and Purchases come
   * in lumps - against an even pace they raise false alarms until ignored.
   */
  evenlySpent: boolean;
  /**
   * Set only on goal funds; null elsewhere. A goal is a normal BIDV fund
   * (balance, allocation, History all shared); this adds target and month.
   */
  goal: Goal | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * `allocation` is the salary split into funds on the 25th - moving money
 * between two of your own buckets, not spending.
 *
 * `opening` is a fund balance that existed before the app. It is the STARTING
 * STATE, not any cycle's cash flow - it must stay out of every In/Out/Invested
 * sum, or the cycle containing it shows `Invested 177.714` with `In 0` and a
 * negative `Left`.
 */
/*
 * `move` moves money between two of your funds (Purchases to Phone). Like
 * `allocation`, it is not spending.
 */
export type TxSource = 'web' | 'import' | 'allocation' | 'opening' | 'move';

/**
 * Direction of the money.
 *
 * `out` is the default - most transactions are money going out.
 * `in` is for two things: refunds (you paid for a picnic and friends paid you
 * back), and ETF top-ups. ETF used to be hardcoded by id in tx-edit.ts; this
 * field removes that exception.
 */
export type TxDirection = 'out' | 'in';

/** Firestore: users/{uid}/transactions/{txId} */
export interface Transaction {
  id: string;
  occurredAt: number;
  /** '2026-09' - the main query field. */
  cycle: string;
  bucketId: string;
  /** COPIED from the bucket on save. If the bucket changes bank, history stays right. */
  bank: Bank;
  /** Integer VND, ALWAYS POSITIVE. Direction lives in `direction`, not the sign. */
  amountVnd: number;
  direction: TxDirection;
  note: string | null;
  source: TxSource;
  /**
   * Only on transactions imported from MoMo screenshots: the dedup key of each
   * row merged into it ('2026-10-04 13:57 out 25000'). Never holds a payee name.
   * See lib/momo-import.ts.
   */
  importKeys?: string[];
  /**
   * Only on `source: 'move'`. A move is TWO entries (`out` on the source
   * fund, `in` on the target) sharing one `moveId`. See lib/moves.ts.
   */
  moveId?: string;
  createdAt: number;
  updatedAt: number;
}

export type CycleStatus = 'open' | 'closed';
export type SurplusTarget = 'etf' | 'reserve' | 'hold';

/** Firestore: users/{uid}/cycles/{cycleId} - id is '2026-09' */
export interface Cycle {
  id: string;
  startAt: number;
  endAt: number;
  /** Frozen when the cycle opens. Editing the baseline never touches the running cycle. */
  limits: Record<string, number>;
  status: CycleStatus;
  closedAt: number | null;
  surplusVnd: number | null;
  surplusTo: SurplusTarget | null;
  /**
   * Snapshot at closing: net spending per bucket. With it, Insights draws a
   * 6-cycle trend by reading 6 documents, not thousands of transactions.
   */
  closedTotals: { byBucket: Record<string, number> } | null;
}

/**
 * Firestore: users/{uid}/salary/{cycleId}
 *
 * A SEPARATE collection, not in `transactions` or cycles: salary is a number
 * to hide, and mixing it into spending data puts every screen at risk of
 * showing it by accident.
 */
export interface Salary {
  /**
   * '2026-09' - also the document id, and a CALENDAR MONTH, NOT the
   * spending cycle that turns on the 25th.
   *
   * Salary received on 25/09 is September's salary. With `cycleOf` it would
   * jump to '2026-10' on payday and every month would land one slot off.
   */
  month: string;
  amountVnd: number;
  note: string | null;
  updatedAt: number;
}

export type CoverStatus = 'pending' | 'done';

/** Firestore: users/{uid}/covers/{coverId} - Stage 5 */
export interface Cover {
  id: string;
  txId: string;
  cycle: string;
  toBucketId: string;
  fromBucketId: string;
  /** Display names captured at creation, so the reminder strip names both
   *  ends without another bucket listener. Old records without them fall
   *  back to the id. */
  toName: string;
  fromName: string;
  /** Only the overage, not the whole transaction. */
  amountVnd: number;
  /** true when the two ends are in different banks - a real transfer is needed. */
  needsTransfer: boolean;
  status: CoverStatus;
  createdAt: number;
  confirmedAt: number | null;
}

/** Firestore: users/{uid}/meta/settings */
export interface Settings {
  cycleStartDay: number;
  reminderHour: number;
  reminderQuietDays: number;
  timezone: string;
  /** Monthly budget for all saving goals together (PLAN-goals.md). */
  goalsMonthlyVnd: number;
}

export const DEFAULT_SETTINGS: Settings = {
  cycleStartDay: CYCLE_START_DAY,
  reminderHour: REMINDER_HOUR,
  reminderQuietDays: REMINDER_QUIET_DAYS,
  timezone: TIMEZONE,
  goalsMonthlyVnd: 3_500_000,
};

// ------------------------------------------------------------
// Starting buckets
//
// Baselines from the average of 5 real cycles (Apr-Aug 2026) in
// Budget.numbers, rounded up. See roadmap/ROADMAP.md.
// ------------------------------------------------------------

export type SeedBucket = Pick<
  Bucket,
  'id' | 'name' | 'kind' | 'bank' | 'standardVnd' | 'hint' | 'order' | 'evenlySpent'
>;

// Write integers directly, NEVER multiply by floats: in JS 4.1 * 1_000_000 is
// 4099999.9999999995, and Firestore rules reject a non-int baselineVnd.
// money.ts warns about this too - it applies to seed data as well.
export const SEED_BUCKETS: SeedBucket[] = [
  // --- VCB, reset each cycle. Ordered by HOW OFTEN logged, not by amount. ---
  {
    id: 'food', name: 'Food', kind: 'budget', bank: 'VCB',
    standardVnd: 3_000_000, order: 10, evenlySpent: true,
    hint: 'Meals, coffee, groceries, BHX',
  },
  {
    id: 'beauty', name: 'Beauty', kind: 'budget', bank: 'VCB',
    standardVnd: 1_000_000, order: 20, evenlySpent: false,
    hint: 'Skincare, serum, acne meds, supplements, haircut',
  },
  {
    id: 'social', name: 'Social', kind: 'budget', bank: 'VCB',
    standardVnd: 1_000_000, order: 30, evenlySpent: false,
    hint: 'Rounds with friends, happy hour, team dinners, gifts',
  },
  {
    id: 'tech', name: 'Tech', kind: 'budget', bank: 'VCB',
    standardVnd: 500_000, order: 40, evenlySpent: false,
    hint: 'Subscriptions (Gemini, Claude, GCP), small accessories',
  },
  {
    id: 'utilities', name: 'Utilities', kind: 'budget', bank: 'VCB',
    standardVnd: 500_000, order: 50, evenlySpent: true,
    hint: 'Phone top-ups, mobile data',
  },
  {
    id: 'buffer', name: 'Buffer', kind: 'budget', bank: 'VCB',
    standardVnd: 1_000_000, order: 60, evenlySpent: false,
    hint: 'Odds and ends, and the cushion when a bucket runs over',
  },

  // --- BIDV, accumulating ---
  {
    // The id stays 'healthFund' so history is unbroken; only the display name changed.
    id: 'healthFund', name: 'Health', kind: 'fund', bank: 'BIDV',
    standardVnd: 3_000_000, order: 70, evenlySpent: false,
    hint: 'Scar treatment, laser, acne clinic, consultations',
  },
  {
    id: 'purchases', name: 'Purchases', kind: 'fund', bank: 'BIDV',
    standardVnd: 3_000_000, order: 80, evenlySpent: false,
    hint: 'Appliances, clothes, dog food, running shoes, devices',
  },
  {
    id: 'travel', name: 'Travel', kind: 'fund', bank: 'BIDV',
    standardVnd: 2_000_000, order: 90, evenlySpent: false,
    hint: 'Everything spent on a trip, meals included',
  },
  {
    id: 'reserve', name: 'Reserve', kind: 'fund', bank: 'BIDV',
    standardVnd: 2_000_000, order: 100, evenlySpent: false,
    hint: 'Yearly wifi, phone, motorbike',
  },
  {
    id: 'emergency', name: 'Emergency', kind: 'fund', bank: 'BIDV',
    standardVnd: 500_000, order: 110, evenlySpent: false,
    hint: 'Real emergencies - leave it alone',
  },

  // --- VPS ---
  // What is left after allocation, so the baseline = 0.
  {
    id: 'etf', name: 'ETF', kind: 'fund', bank: 'VPS',
    standardVnd: 0, order: 120, evenlySpent: false,
    hint: 'What is left after allocation, moved to VPS',
  },
];
