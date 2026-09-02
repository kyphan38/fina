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
  /** Mức mặc định khi MỞ chu kỳ mới. Không đụng chu kỳ đang chạy. */
  baselineVnd: number;
  /** Mức chuẩn người dùng tự đặt. Chỉ để so sánh, không bao giờ tự áp dụng. */
  standardVnd: number;
  /** Bucket này gồm những gì. Hiện khi chọn, tự ẩn khi bắt đầu gõ số. */
  hint: string | null;
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
  'id' | 'name' | 'kind' | 'bank' | 'baselineVnd' | 'standardVnd' | 'hint' | 'order' | 'goal'
>;

// Viết thẳng số nguyên, KHÔNG nhân với số thực: 4.1 * 1_000_000 trong JS ra
// 4099999.9999999995, và Firestore rules chặn baselineVnd không phải int.
// Chính money.ts đã cảnh báo chuyện này - nó cũng đúng với dữ liệu seed.
export const SEED_BUCKETS: SeedBucket[] = [
  // --- VCB, reset mỗi chu kỳ. Thứ tự theo SỐ LẦN LOG, không theo số tiền. ---
  {
    id: 'food', name: 'Food', kind: 'budget', bank: 'VCB',
    baselineVnd: 3_000_000, standardVnd: 3_000_000, order: 10, goal: null,
    hint: 'Meals, coffee, groceries, BHX',
  },
  {
    id: 'beauty', name: 'Beauty', kind: 'budget', bank: 'VCB',
    baselineVnd: 1_000_000, standardVnd: 1_000_000, order: 20, goal: null,
    hint: 'Skincare, serum, acne meds, supplements, haircut',
  },
  {
    id: 'social', name: 'Social', kind: 'budget', bank: 'VCB',
    baselineVnd: 1_000_000, standardVnd: 1_000_000, order: 30, goal: null,
    hint: 'Rounds with friends, happy hour, team dinners, gifts',
  },
  {
    id: 'tech', name: 'Tech', kind: 'budget', bank: 'VCB',
    baselineVnd: 500_000, standardVnd: 500_000, order: 40, goal: null,
    hint: 'Subscriptions (Gemini, Claude, GCP), small accessories',
  },
  {
    id: 'utilities', name: 'Utilities', kind: 'budget', bank: 'VCB',
    baselineVnd: 500_000, standardVnd: 500_000, order: 50, goal: null,
    hint: 'Phone top-ups, mobile data',
  },
  {
    id: 'buffer', name: 'Buffer', kind: 'budget', bank: 'VCB',
    baselineVnd: 1_000_000, standardVnd: 1_000_000, order: 60, goal: null,
    hint: 'Odds and ends, and the cushion when a bucket runs over',
  },

  // --- BIDV, cộng dồn ---
  {
    // id giữ nguyên 'healthFund' để lịch sử không đứt, chỉ đổi tên hiển thị.
    id: 'healthFund', name: 'Health', kind: 'fund', bank: 'BIDV',
    baselineVnd: 3_000_000, standardVnd: 3_000_000, order: 70, goal: null,
    hint: 'Scar treatment, laser, acne clinic, consultations',
  },
  {
    id: 'purchases', name: 'Purchases', kind: 'fund', bank: 'BIDV',
    baselineVnd: 3_000_000, standardVnd: 3_000_000, order: 80, goal: null,
    hint: 'Appliances, clothes, dog food, running shoes, devices',
  },
  {
    id: 'travel', name: 'Travel', kind: 'fund', bank: 'BIDV',
    baselineVnd: 2_000_000, standardVnd: 2_000_000, order: 90, goal: null,
    hint: 'Everything spent on a trip, meals included',
  },
  {
    id: 'reserve', name: 'Reserve', kind: 'fund', bank: 'BIDV',
    baselineVnd: 2_000_000, standardVnd: 2_000_000, order: 100, goal: null,
    hint: 'Yearly wifi, phone, motorbike',
  },
  {
    id: 'emergency', name: 'Emergency', kind: 'fund', bank: 'BIDV',
    baselineVnd: 500_000, standardVnd: 500_000, order: 110, goal: null,
    hint: 'Real emergencies - leave it alone',
  },

  // --- VPS ---
  // Phần dư sau khi phân bổ, nên baseline = 0.
  {
    id: 'etf', name: 'ETF', kind: 'fund', bank: 'VPS',
    baselineVnd: 0, standardVnd: 0, order: 120, goal: null,
    hint: 'What is left after allocation, moved to VPS',
  },
];
