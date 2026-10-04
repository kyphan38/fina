// ============================================================
// fina - Nhập lịch sử MoMo từ ảnh chụp màn hình
//
// Model chỉ ĐỌC chữ trên ảnh. Mọi quyết định (năm nào, dòng nào trùng, dòng
// nào đáng nghi, gộp ra sao) nằm ở đây - thuần tuý, có test, không tin model.
//
// Tên người nhận chỉ để người dùng đối chiếu lúc duyệt. Nó KHÔNG bao giờ được
// ghi vào DB: khoá chống trùng chỉ gồm thời điểm, chiều và số tiền.
// ============================================================

import { cycleOf } from '@/lib/cycle';
import type { Transaction, TxDirection } from '@/types/fina';

/** Một dòng như model đọc được. `amount` có dấu: −25.000đ -> -25000. */
export interface RawRow {
  title: string;
  amount: number;
  /** 'HH:MM' */
  time: string;
  /** 'DD/MM' - MoMo không in năm. */
  date: string;
}

/** Vì sao một dòng đáng để người dùng nhìn kỹ. Không tự bỏ - chỉ gắn nhãn. */
export type RowFlag = 'self' | 'income' | 'manual';

export interface ImportRow {
  /** Id cục bộ cho React và cho nút xoá. */
  id: string;
  /** Khoá chống trùng, lưu vào `importKeys` của transaction. Không có tên. */
  key: string;
  occurredAt: number;
  title: string;
  amountVnd: number;
  direction: TxDirection;
  bucketId: string;
  note: string;
  flag: RowFlag | null;
  /** Giao dịch nhập tay trông giống dòng này - để hiện nhãn cảnh báo. */
  lookalike: { bucketId: string; occurredAt: number } | null;
}

export const DEFAULT_BUCKET = 'food';

/** Giao dịch nhập tay lệch giờ bao nhiêu thì vẫn coi là "có thể là một". */
const LOOKALIKE_WINDOW_MS = 3 * 60 * 60_000;

/** Bỏ dấu và viết thường: 'Hoàn tiền về' -> 'hoan tien ve'. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Tiền đi về tài khoản của chính mình, không phải chi tiêu.
 *
 * Cố ý KHÔNG bắt 'nạp tiền' trơn: 'Nạp tiền điện thoại' là chi tiêu thật.
 */
const SELF_PREFIXES = ['hoan tien ve', 'rut tien', 'chuyen tien ve', 'nap tien vao vi'];

export function flagOf(title: string, signedAmount: number): RowFlag | null {
  if (signedAmount > 0) return 'income';
  const t = fold(title);
  if (SELF_PREFIXES.some((p) => t.startsWith(p))) return 'self';
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 'DD/MM' + 'HH:MM' -> mốc thời gian theo giờ máy.
 *
 * Năm lấy theo hôm nay. Ra ngày ở TƯƠNG LAI thì lùi một năm - tháng 1 chụp
 * lại lịch sử tháng 12. Cho dư một ngày vì giờ máy và giờ MoMo có thể lệch.
 */
export function parseWhen(date: string, time: string, now: Date): number | null {
  const d = /^(\d{1,2})\/(\d{1,2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;

  const day = Number(d[1]);
  const month = Number(d[2]);
  const hour = Number(t[1]);
  const minute = Number(t[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  let at = new Date(now.getFullYear(), month - 1, day, hour, minute);
  // 31/02 bị Date đẩy sang tháng 3 - đó là chữ đọc sai, không phải ngày thật.
  if (at.getDate() !== day) return null;
  if (at.getTime() > now.getTime() + 86_400_000) {
    at = new Date(now.getFullYear() - 1, month - 1, day, hour, minute);
  }
  return at.getTime();
}

/** Khoá chống trùng. Đủ chặt: cùng phút, cùng chiều, cùng số tiền. */
export function importKey(occurredAt: number, direction: TxDirection, amountVnd: number): string {
  const d = new Date(occurredAt);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} ${direction} ${amountVnd}`;
}

/**
 * Gộp các ảnh thành một danh sách, bỏ phần chồng lên nhau.
 *
 * Cuộn màn hình thì dòng cuối ảnh trước hay lặp lại ở đầu ảnh sau. Nhưng
 * TRONG cùng một ảnh, hai dòng giống hệt là hai giao dịch thật (trả hai lần
 * cùng một phút). Nên mỗi khoá giữ số lần xuất hiện NHIỀU NHẤT trong một ảnh,
 * không phải tổng các ảnh.
 *
 * Khoá không chứa tên: cùng một dòng bị cắt chữ khác nhau ở hai ảnh vẫn
 * phải khớp.
 */
export function mergeScreenshots(
  images: RawRow[][],
  now: Date,
): { rows: ImportRow[]; overlapCount: number; unreadable: number } {
  const best = new Map<string, number>();
  const firstSeen = new Map<string, ImportRow[]>();
  let total = 0;
  let unreadable = 0;

  for (const image of images) {
    const counts = new Map<string, number>();
    for (const raw of image) {
      const occurredAt = parseWhen(raw.date, raw.time, now);
      const amountVnd = Math.abs(Math.round(raw.amount));
      if (occurredAt === null || !Number.isFinite(amountVnd) || amountVnd === 0) {
        unreadable += 1;
        continue;
      }
      total += 1;
      const direction: TxDirection = raw.amount > 0 ? 'in' : 'out';
      const key = importKey(occurredAt, direction, amountVnd);
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);

      // Chỉ thêm dòng khi ảnh này có NHIỀU bản hơn mọi ảnh trước.
      if (n > (best.get(key) ?? 0)) {
        const list = firstSeen.get(key) ?? [];
        list.push({
          id: `${key}#${n}`,
          key,
          occurredAt,
          title: raw.title.trim(),
          amountVnd,
          direction,
          bucketId: DEFAULT_BUCKET,
          note: '',
          flag: flagOf(raw.title, raw.amount),
          lookalike: null,
        });
        firstSeen.set(key, list);
        best.set(key, n);
      }
    }
  }

  const rows = [...firstSeen.values()].flat().sort((a, b) => b.occurredAt - a.occurredAt);
  return { rows, overlapCount: total - rows.length, unreadable };
}

/**
 * So với những gì đã có trong DB.
 *
 *  - Khớp `importKeys` của một lần import trước -> tách ra `imported`. Đây là
 *    trùng chắc chắn; để lại thì tiền bị tính hai lần.
 *  - Giống một giao dịch NHẬP TAY (cùng chiều, cùng số tiền, lệch dưới 3 giờ)
 *    -> vẫn giữ, chỉ gắn nhãn. Ăn trưa 35k hai ngày liền là chuyện thường.
 *
 * Mỗi giao dịch cũ chỉ được "dùng" một lần, nên hai dòng 25k không cùng bị
 * gán vào một giao dịch 25k nhập tay.
 */
export function checkAgainstExisting(
  rows: ImportRow[],
  existing: Transaction[],
): { kept: ImportRow[]; imported: ImportRow[] } {
  const keyCounts = new Map<string, number>();
  for (const tx of existing) {
    for (const k of tx.importKeys ?? []) keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
  }

  const manual = existing.filter((tx) => !tx.importKeys?.length && tx.source === 'web');
  const used = new Set<string>();

  const kept: ImportRow[] = [];
  const imported: ImportRow[] = [];

  for (const row of rows) {
    const left = keyCounts.get(row.key) ?? 0;
    if (left > 0) {
      keyCounts.set(row.key, left - 1);
      imported.push(row);
      continue;
    }

    let match: Transaction | null = null;
    for (const tx of manual) {
      if (used.has(tx.id)) continue;
      if (tx.direction !== row.direction || tx.amountVnd !== row.amountVnd) continue;
      const gap = Math.abs(tx.occurredAt - row.occurredAt);
      if (gap > LOOKALIKE_WINDOW_MS) continue;
      if (!match || gap < Math.abs(match.occurredAt - row.occurredAt)) match = tx;
    }

    if (match) {
      used.add(match.id);
      kept.push({
        ...row,
        flag: row.flag ?? 'manual',
        lookalike: { bucketId: match.bucketId, occurredAt: match.occurredAt },
      });
    } else {
      kept.push(row);
    }
  }

  return { kept, imported };
}

/** Một transaction sắp ghi. */
export interface ImportDraft {
  bucketId: string;
  amountVnd: number;
  direction: TxDirection;
  occurredAt: number;
  note: string | null;
  importKeys: string[];
}

/**
 * Bảng đã duyệt -> danh sách transaction.
 *
 * `merge`: dòng KHÔNG có note gộp theo (mục, chu kỳ, chiều) - một mục một
 * con số. Dòng CÓ note giữ riêng, vì note chỉ có nghĩa với đúng khoản đó.
 *
 * Gộp phải tách theo chu kỳ: ngày 24 và 25 thuộc hai tháng khác nhau, gộp
 * chung thì cả cục rơi vào tháng của dòng mới nhất.
 */
export function buildDrafts(rows: ImportRow[], merge: boolean): ImportDraft[] {
  const drafts: ImportDraft[] = [];
  const groups = new Map<string, ImportRow[]>();

  for (const row of rows) {
    const note = row.note.trim();
    if (!merge || note) {
      drafts.push({
        bucketId: row.bucketId,
        amountVnd: row.amountVnd,
        direction: row.direction,
        occurredAt: row.occurredAt,
        note: note || null,
        importKeys: [row.key],
      });
      continue;
    }
    const g = `${row.bucketId}|${cycleOf(new Date(row.occurredAt))}|${row.direction}`;
    const list = groups.get(g) ?? [];
    list.push(row);
    groups.set(g, list);
  }

  for (const list of groups.values()) {
    if (list.length === 1) {
      const [row] = list;
      drafts.push({
        bucketId: row.bucketId,
        amountVnd: row.amountVnd,
        direction: row.direction,
        occurredAt: row.occurredAt,
        note: null,
        importKeys: [row.key],
      });
      continue;
    }
    drafts.push({
      bucketId: list[0].bucketId,
      // Cộng số nguyên VND - không có số thực nào ở đây.
      amountVnd: list.reduce((s, r) => s + r.amountVnd, 0),
      direction: list[0].direction,
      // Mốc của dòng mới nhất, để cả cục nằm cuối ngày trong History.
      occurredAt: Math.max(...list.map((r) => r.occurredAt)),
      note: `MoMo · ${list.length} payments`,
      importKeys: list.map((r) => r.key),
    });
  }

  return drafts.sort((a, b) => b.occurredAt - a.occurredAt);
}

/**
 * '-330.000đ' -> -330000. Trả null khi không đúng dạng tiền MoMo.
 *
 * Model CHÉP chữ chứ không tự đổi ra số: lúc tự đổi, nó từng đọc -330.000đ
 * thành -33000. Chép từng ký tự thì đúng hơn hẳn, còn đổi ra số là việc của
 * code. Không có dấu thì coi là tiền ra - MoMo luôn in '+' cho tiền vào.
 */
export function parseAmountText(text: string): number | null {
  const m = /^([+\-\u2212])?\s*(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:đ|₫|vnd)?$/i.exec(text.trim());
  if (!m) return null;
  const n = Number(m[2].replace(/[.,]/g, ''));
  if (!Number.isSafeInteger(n) || n === 0) return null;
  return m[1] === '+' ? n : -n;
}

/** Model trả về gì cũng phải qua đây. Dòng sai hình dạng bị bỏ, không đoán. */
export function sanitizeRows(value: unknown): RawRow[] {
  const list = (value as { rows?: unknown })?.rows;
  if (!Array.isArray(list)) return [];
  const out: RawRow[] = [];
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    const { title, amount, time, date } = r as Record<string, unknown>;
    if (typeof title !== 'string' || typeof time !== 'string' || typeof date !== 'string') continue;
    const n = typeof amount === 'string' ? parseAmountText(amount) : null;
    if (n === null || Math.abs(n) > 1_000_000_000) continue;
    out.push({ title: title.slice(0, 160), amount: n, time, date });
  }
  return out;
}

/**
 * Thêm dòng mới vào một bảng đang duyệt dở - upload thêm ảnh từ máy khác.
 *
 * Cùng luật số lần như `mergeScreenshots`: bảng đã có khoá K hai lần thì chỉ
 * thêm những bản K thứ ba trở đi. Đếm cả dòng đã xoá khỏi bảng - xoá rồi
 * upload lại ảnh cũ thì dòng đó không được hiện lại.
 */
export function appendRows(existing: ImportRow[], incoming: ImportRow[]): ImportRow[] {
  const have = new Map<string, number>();
  for (const r of existing) have.set(r.key, (have.get(r.key) ?? 0) + 1);
  const ids = new Set(existing.map((r) => r.id));

  const seen = new Map<string, number>();
  const out: ImportRow[] = [];
  for (const r of incoming) {
    const n = (seen.get(r.key) ?? 0) + 1;
    seen.set(r.key, n);
    if (n <= (have.get(r.key) ?? 0)) continue;

    let id = r.id;
    for (let i = n; ids.has(id); i += 1) id = `${r.key}#${i + 1}`;
    ids.add(id);
    out.push({ ...r, id });
  }
  return out;
}
