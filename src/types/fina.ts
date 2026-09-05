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
  /**
   * Tiêu rải đều trong tháng hay tiêu theo cục.
   *
   * Chỉ bucket "đều" mới so được với nhịp tuyến tính. Health và Purchases đến
   * theo cục - so với nhịp đều sẽ báo động giả liên tục cho tới khi bị bỏ qua.
   */
  evenlySpent: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * `allocation` là khoản chia lương vào quỹ ngày 25 - chuyển tiền giữa hai hũ
 * của chính mình, không phải chi tiêu.
 *
 * `opening` là số dư quỹ có sẵn trước khi app bắt đầu. Nó là TRẠNG THÁI BAN
 * ĐẦU, không phải dòng tiền của chu kỳ nào - phải nằm ngoài mọi phép tính
 * In/Out/Invested, nếu không chu kỳ chứa nó sẽ hiện `Invested 177.714` với
 * `In 0` và `Left` âm.
 */
export type TxSource = 'web' | 'import' | 'allocation' | 'opening';

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

export type CycleStatus = 'open' | 'closed';
export type SurplusTarget = 'etf' | 'reserve' | 'hold';

/** Firestore: users/{uid}/cycles/{cycleId} - id là '2026-09' */
export interface Cycle {
  id: string;
  startAt: number;
  endAt: number;
  /** Đóng băng lúc mở chu kỳ. Sửa baseline không đụng chu kỳ đang chạy. */
  limits: Record<string, number>;
  status: CycleStatus;
  closedAt: number | null;
  surplusVnd: number | null;
  surplusTo: SurplusTarget | null;
  /**
   * Chụp lại lúc đóng sổ: chi tiêu ròng theo từng bucket. Có nó thì Insights
   * vẽ được xu hướng 6 chu kỳ mà chỉ đọc 6 document, không phải vài nghìn
   * giao dịch.
   */
  closedTotals: { byBucket: Record<string, number> } | null;
}

/**
 * Firestore: users/{uid}/salary/{cycleId}
 *
 * Collection RIÊNG, không nằm trong `transactions` hay chu kỳ: lương là con
 * số cần che, và để nó lẫn vào dữ liệu chi tiêu thì mọi màn hình đều có nguy
 * cơ vô tình hiện nó ra.
 */
export interface Salary {
  /**
   * '2026-09' - cũng chính là id document, và là THÁNG DƯƠNG LỊCH, KHÔNG
   * phải chu kỳ cắt ngày 25 của phần chi tiêu.
   *
   * Lương nhận ngày 25/09 là lương tháng 9. Dùng `cycleOf` ở đây thì đúng
   * ngày lĩnh lương nó nhảy sang '2026-10' và mọi tháng bị ghi lệch một ô.
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
  /** Tên hiển thị chụp lại lúc tạo, để dải nhắc gọi đúng tên hai đầu mà
   *  không phải nghe thêm một listener bucket nào. Bản ghi cũ không có thì
   *  rơi về id. */
  toName: string;
  fromName: string;
  /** Chỉ phần vượt, không phải cả giao dịch. */
  amountVnd: number;
  /** true khi hai đầu khác ngân hàng - cần chuyển khoản thật. */
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
  'id' | 'name' | 'kind' | 'bank' | 'standardVnd' | 'hint' | 'order' | 'evenlySpent'
>;

// Viết thẳng số nguyên, KHÔNG nhân với số thực: 4.1 * 1_000_000 trong JS ra
// 4099999.9999999995, và Firestore rules chặn baselineVnd không phải int.
// Chính money.ts đã cảnh báo chuyện này - nó cũng đúng với dữ liệu seed.
export const SEED_BUCKETS: SeedBucket[] = [
  // --- VCB, reset mỗi chu kỳ. Thứ tự theo SỐ LẦN LOG, không theo số tiền. ---
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

  // --- BIDV, cộng dồn ---
  {
    // id giữ nguyên 'healthFund' để lịch sử không đứt, chỉ đổi tên hiển thị.
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
  // Phần dư sau khi phân bổ, nên baseline = 0.
  {
    id: 'etf', name: 'ETF', kind: 'fund', bank: 'VPS',
    standardVnd: 0, order: 120, evenlySpent: false,
    hint: 'What is left after allocation, moved to VPS',
  },
];
