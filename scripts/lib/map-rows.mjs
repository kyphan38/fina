// ============================================================
// Luật map dữ liệu Budget.numbers cũ sang bucket mới.
// Bảng đầy đủ và con số phải khớp: roadmap/STAGE-4-DETAILED.md
// ============================================================

/** Bỏ dấu tiếng Việt để so khớp ghi chú ổn định. */
export const norm = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase().trim();

export const SKIP_TRANSFER = 'SKIP_TRANSFER';
export const SKIP_UNKNOWN = 'SKIP_UNKNOWN';

const TRANSFER = ['self fund', 'all for travelling'];
const UNKNOWN = ['placeholder', 'bi ben', 'stuff for safety'];

const RULES = {
  FDU: [
    [['bros', 'anh em', 'friends', 'happy hour', 'dl team', 'w harry', 'voi ban', 'voi anh h', 'moi '], 'social'],
    [['card', '4g'], 'utilities'],
    [['gasoline'], 'buffer'],
  ],
  Health: [
    [['seo', 'laser'], 'healthFund'],
    [['may hap dien'], 'purchases'],
  ],
  Others: [
    [['tu lanh', 'may say', 'ghe cong', 'tam ga', 'ban lam viec', 'den cho ban',
      'dung cu setup', 'boc ghe', 'hop quan ao', 'coolmate', 'do an minu'], 'purchases'],
    [['wifi', 'card dt'], 'reserve'],
    [['ca phe'], 'food'],
    [['sach', 'bang diem', 'film', 'grab', 'cho me', 'photocopy', 'op lung'], 'buffer'],
    // Others khong co ghi chu: nguoi dung khong nho la gi, va so tien nho.
    // Xep vao buffer - dung cho hu "linh tinh" - thay vi dung ca lan import.
    [[''], 'buffer'],
  ],
};

const FALLBACK = { FDU: 'food', Health: 'beauty', Tech: 'tech' };

/**
 * Trả về id bucket, hoặc SKIP_*, hoặc null khi không luật nào khớp.
 *
 * null nghĩa là DỪNG và hỏi người dùng. Không đoán, không nhét vào buffer
 * cho xong - một dòng xếp sai sẽ nằm im trong báo cáo nhiều năm.
 */
export function mapRow(category, note) {
  const n = norm(note ?? '');
  // includes('') luon dung, nen luat [''] o cuoi Others = "moi thu con lai".
  const has = (keys) => keys.some((k) => n.includes(k));

  if (has(TRANSFER)) return SKIP_TRANSFER;
  if (has(UNKNOWN)) return SKIP_UNKNOWN;

  for (const [keys, bucket] of RULES[category] ?? []) {
    if (has(keys)) return bucket;
  }
  return FALLBACK[category] ?? null;
}

/** '24 Jul 2026 at 06:12' -> Date theo giờ máy. */
export function parseNumbersDate(raw) {
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})(?:\s+at\s+(\d{1,2}):(\d{2}))?/.exec(raw.trim());
  if (!m) return null;
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const month = months.indexOf(m[2].toLowerCase());
  if (month < 0) return null;
  return new Date(Number(m[3]), month, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0));
}
