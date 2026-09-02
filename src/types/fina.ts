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
  /**
   * Mức chuẩn. Hiếm khi đổi. Dùng cho hai việc:
   *  - mặc định khi MỞ chu kỳ mới
   *  - điền sẵn Generator
   * Không bao giờ tự chảy sang chu kỳ đang chạy.
   */
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

/**
 * `allocation` là khoản chia lương vào quỹ ngày 25. Nó KHÔNG phải chi tiêu -
 * mọi phép cộng chi tiêu phải loại nó ra (xem `cashflow.ts`).
 */
export type TxSource = 'web' | 'import' | 'allocation';

/**
 * Chiều của tiền.
 *
 * `out` là mặc định - hầu hết giao dịch là tiền đi ra.
 * `in` dùng cho hai chuyện: được hoàn lại (ứng tiền đi picnic rồi bạn bè trả
 * lại), và nạp ETF. Trước đây ETF bị hard-code theo id ở tx-edit.ts; có
 * field này thì cái ngoại lệ đó biến mất.
 */
export type TxDirection = 'out' | 'in';

/** Firestore: users/{uid}/transactions/{txId} */
export interface Transaction {
  id: string;
  occurredAt: number;
  /** '2026-09' - field query chính. */
  cycle: string;
  bucketId: string;
  /** CHÉP từ bucket lúc lưu. Bucket đổi ngân hàng thì lịch sử vẫn đúng. */
  bank: Bank;
  /** Số nguyên VND, LUÔN DƯƠNG. Chiều nằm ở `direction`, không nằm ở dấu. */
  amountVnd: number;
  direction: TxDirection;
  note: string | null;
  source: TxSource;
  createdAt: number;
  updatedAt: number;
}

export type IncomeKind = 'salary' | 'other';

/**
 * Firestore: users/{uid}/income/{id}
 *
 * Collection RIÊNG, không nằm chung `transactions`. Đã có một lỗi chứng minh
 * lý do: tổng ở History từng trừ khoản nạp ETF vì nó là giao dịch `in`. Thứ
 * gì không phải chi tiêu mà để chung với chi tiêu thì mọi phép cộng đều phải
 * nhớ loại nó ra, và sẽ có lần quên.
 */
export interface Income {
  id: string;
  occurredAt: number;
  cycle: string;
  /** Luôn dương. */
  amountVnd: number;
  kind: IncomeKind;
  note: string | null;
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
  /**
   * Chụp lại lúc đóng sổ, để bảng dòng tiền theo năm không phải đọc lại toàn
   * bộ giao dịch của 12 chu kỳ.
   */
  closedTotals: { outVnd: number; investedVnd: number } | null;
  closedIncomeVnd: number | null;
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
  'id' | 'name' | 'kind' | 'bank' | 'standardVnd' | 'hint' | 'order' | 'goal'
>;

// Viết thẳng số nguyên, KHÔNG nhân với số thực: 4.1 * 1_000_000 trong JS ra
// 4099999.9999999995, và Firestore rules chặn baselineVnd không phải int.
// Chính money.ts đã cảnh báo chuyện này - nó cũng đúng với dữ liệu seed.
export const SEED_BUCKETS: SeedBucket[] = [
  // --- VCB, reset mỗi chu kỳ. Thứ tự theo SỐ LẦN LOG, không theo số tiền. ---
  {
    id: 'food', name: 'Food', kind: 'budget', bank: 'VCB',
    standardVnd: 3_000_000, order: 10, goal: null,
    hint: 'Meals, coffee, groceries, BHX',
  },
  {
    id: 'beauty', name: 'Beauty', kind: 'budget', bank: 'VCB',
    standardVnd: 1_000_000, order: 20, goal: null,
    hint: 'Skincare, serum, acne meds, supplements, haircut',
  },
  {
    id: 'social', name: 'Social', kind: 'budget', bank: 'VCB',
    standardVnd: 1_000_000, order: 30, goal: null,
    hint: 'Rounds with friends, happy hour, team dinners, gifts',
  },
  {
    id: 'tech', name: 'Tech', kind: 'budget', bank: 'VCB',
    standardVnd: 500_000, order: 40, goal: null,
    hint: 'Subscriptions (Gemini, Claude, GCP), small accessories',
  },
  {
    id: 'utilities', name: 'Utilities', kind: 'budget', bank: 'VCB',
    standardVnd: 500_000, order: 50, goal: null,
    hint: 'Phone top-ups, mobile data',
  },
  {
    id: 'buffer', name: 'Buffer', kind: 'budget', bank: 'VCB',
    standardVnd: 1_000_000, order: 60, goal: null,
    hint: 'Odds and ends, and the cushion when a bucket runs over',
  },

  // --- BIDV, cộng dồn ---
  {
    // id giữ nguyên 'healthFund' để lịch sử không đứt, chỉ đổi tên hiển thị.
    id: 'healthFund', name: 'Health', kind: 'fund', bank: 'BIDV',
    standardVnd: 3_000_000, order: 70, goal: null,
    hint: 'Scar treatment, laser, acne clinic, consultations',
  },
  {
    id: 'purchases', name: 'Purchases', kind: 'fund', bank: 'BIDV',
    standardVnd: 3_000_000, order: 80, goal: null,
    hint: 'Appliances, clothes, dog food, running shoes, devices',
  },
  {
    id: 'travel', name: 'Travel', kind: 'fund', bank: 'BIDV',
    standardVnd: 2_000_000, order: 90, goal: null,
    hint: 'Everything spent on a trip, meals included',
  },
  {
    id: 'reserve', name: 'Reserve', kind: 'fund', bank: 'BIDV',
    standardVnd: 2_000_000, order: 100, goal: null,
    hint: 'Yearly wifi, phone, motorbike',
  },
  {
    id: 'emergency', name: 'Emergency', kind: 'fund', bank: 'BIDV',
    standardVnd: 500_000, order: 110, goal: null,
    hint: 'Real emergencies - leave it alone',
  },

  // --- VPS ---
  // Phần dư sau khi phân bổ, nên baseline = 0.
  {
    id: 'etf', name: 'ETF', kind: 'fund', bank: 'VPS',
    standardVnd: 0, order: 120, goal: null,
    hint: 'What is left after allocation, moved to VPS',
  },
];
