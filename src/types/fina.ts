// ============================================================
// fina - Mô hình dữ liệu
//
// Quy tắc bất biến (roadmap/ROADMAP.md):
//  - Tiền LUÔN là số nguyên VND. UI nhập/hiện theo nghìn.
//  - Chỉ hai loại hũ: budget (reset mỗi chu kỳ) và fund (cộng dồn).
//  - Chu kỳ cắt ngày 25.
// ============================================================

export const CYCLE_START_DAY = 25;
export const TIMEZONE = 'Asia/Ho_Chi_Minh';
export const REMINDER_HOUR = 22;
export const REMINDER_QUIET_DAYS = 2;

export type BucketKind = 'budget' | 'fund';
export type Bank = 'VCB' | 'BIDV' | 'VPS';

export interface Goal {
  targetVnd: number;
  /** 'YYYY-MM' - mốc dự kiến xong. */
  targetDate: string;
}

/** Firestore: users/{uid}/buckets/{bucketId} */
export interface Bucket {
  id: string;
  name: string;
  kind: BucketKind;
  bank: Bank;
  /** Số tiền chuẩn mỗi chu kỳ. */
  baselineVnd: number;
  /**
   * Chỉ dùng với kind='fund'. Denormalize để khỏi cộng lại toàn bộ lịch sử
   * mỗi lần mở app. Có thể âm khi tiêu lố. Dựng lại được bằng
   * scripts/recompute-balances.mjs.
   */
  balanceVnd: number;
  /** Thứ tự trên lưới. Cố định - không tự sắp theo tần suất. */
  order: number;
  active: boolean;
  goal: Goal | null;
  createdAt: number;
  updatedAt: number;
}

export type TxSource = 'web' | 'import';

/** Firestore: users/{uid}/transactions/{txId} */
export interface Transaction {
  id: string;
  occurredAt: number;
  /** '2026-09' - field query chính. */
  cycle: string;
  bucketId: string;
  /** CHÉP từ bucket lúc lưu. Bucket đổi ngân hàng thì lịch sử vẫn đúng. */
  bank: Bank;
  /** Số nguyên VND, luôn dương. */
  amountVnd: number;
  note: string | null;
  source: TxSource;
  createdAt: number;
  updatedAt: number;
}

export type CycleStatus = 'open' | 'closed';
export type SurplusTarget = 'etf' | 'reserve' | 'hold';

/** Firestore: users/{uid}/cycles/{cycleId} - id là '2026-09' */
export interface Cycle {
  id: string;
  startAt: number;
  endAt: number;
  incomeVnd: number | null;
  /** Đóng băng lúc mở chu kỳ. Sửa baseline không đụng chu kỳ đang chạy. */
  limits: Record<string, number>;
  status: CycleStatus;
  closedAt: number | null;
  surplusVnd: number | null;
  surplusTo: SurplusTarget | null;
}

export type CoverStatus = 'pending' | 'done';

/** Firestore: users/{uid}/covers/{coverId} - Stage 5 */
export interface Cover {
  id: string;
  txId: string;
  cycle: string;
  toBucketId: string;
  fromBucketId: string;
  /** Chỉ phần vượt, không phải cả giao dịch. */
  amountVnd: number;
  /** true khi nguồn bù ở BIDV - cần chuyển khoản thật. */
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
}

export const DEFAULT_SETTINGS: Settings = {
  cycleStartDay: CYCLE_START_DAY,
  reminderHour: REMINDER_HOUR,
  reminderQuietDays: REMINDER_QUIET_DAYS,
  timezone: TIMEZONE,
};

// ------------------------------------------------------------
// Bộ hũ khởi tạo
//
// Baseline lấy từ trung bình 5 chu kỳ thật (Apr-Aug 2026) trong
// Budget.numbers, làm tròn lên. Xem roadmap/ROADMAP.md.
// ------------------------------------------------------------

export type SeedBucket = Pick<
  Bucket,
  'id' | 'name' | 'kind' | 'bank' | 'baselineVnd' | 'order' | 'goal'
>;

// Viết thẳng số nguyên, KHÔNG nhân với số thực: 4.1 * 1_000_000 trong JS ra
// 4099999.9999999995, và Firestore rules chặn baselineVnd không phải int.
// Chính money.ts đã cảnh báo chuyện này - nó cũng đúng với dữ liệu seed.
export const SEED_BUCKETS: SeedBucket[] = [
  // --- VCB, reset mỗi chu kỳ. Thứ tự theo SỐ LẦN LOG, không theo số tiền. ---
  { id: 'food', name: 'Food', kind: 'budget', bank: 'VCB', baselineVnd: 3_000_000, order: 10, goal: null },
  { id: 'beauty', name: 'Beauty', kind: 'budget', bank: 'VCB', baselineVnd: 1_800_000, order: 20, goal: null },
  { id: 'social', name: 'Social', kind: 'budget', bank: 'VCB', baselineVnd: 700_000, order: 30, goal: null },
  { id: 'tech', name: 'Tech', kind: 'budget', bank: 'VCB', baselineVnd: 800_000, order: 40, goal: null },
  // Wifi (3tr/năm) nằm ở quỹ Reserve, nên đây chỉ còn card điện thoại.
  // Cần xem lại sau 2 chu kỳ dùng thật.
  { id: 'utilities', name: 'Utilities', kind: 'budget', bank: 'VCB', baselineVnd: 200_000, order: 50, goal: null },
  // Vừa là hũ linh tinh, vừa là đệm khi tiêu lố. Reset mỗi chu kỳ.
  { id: 'buffer', name: 'Buffer', kind: 'budget', bank: 'VCB', baselineVnd: 1_000_000, order: 60, goal: null },

  // --- BIDV, cộng dồn ---
  {
    id: 'healthFund',
    name: 'Health Fund',
    kind: 'fund',
    bank: 'BIDV',
    baselineVnd: 3_500_000,
    order: 70,
    goal: { targetVnd: 42_000_000, targetDate: '2027-09' },
  },
  { id: 'purchases', name: 'Purchases', kind: 'fund', bank: 'BIDV', baselineVnd: 4_100_000, order: 80, goal: null },
  { id: 'travel', name: 'Travel', kind: 'fund', bank: 'BIDV', baselineVnd: 1_200_000, order: 90, goal: null },
  // Wifi (năm), iPhone, xe máy. Con số chưa chốt - đặt trong Settings.
  { id: 'reserve', name: 'Reserve', kind: 'fund', bank: 'BIDV', baselineVnd: 0, order: 100, goal: null },
  { id: 'emergency', name: 'Emergency', kind: 'fund', bank: 'BIDV', baselineVnd: 250_000, order: 110, goal: null },

  // --- VPS ---
  // Phần dư sau khi phân bổ, nên baseline = 0.
  { id: 'etf', name: 'ETF', kind: 'fund', bank: 'VPS', baselineVnd: 0, order: 120, goal: null },
];
