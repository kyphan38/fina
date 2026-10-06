// ============================================================
// fina - Import MoMo history from screenshots
//
// The model only READS text on the image. Every decision (which year, which
// rows repeat, which look suspicious, how to merge) lives here - pure,
// tested, never trusting the model.
//
// Payee names are only for the user to check while reviewing. They are NEVER
// written to the DB: the dedup key is only time, direction and amount.
// ============================================================

import { cycleOf } from '@/lib/cycle';
import type { Transaction, TxDirection } from '@/types/fina';

/** One row as the model read it. `amount` is signed: −25.000đ -> -25000. */
export interface RawRow {
  title: string;
  amount: number;
  /** 'HH:MM' */
  time: string;
  /** 'DD/MM' - MoMo prints no year. */
  date: string;
}

/** Why a row deserves a closer look. Never dropped automatically - only labeled. */
export type RowFlag = 'self' | 'income' | 'manual';

export interface ImportRow {
  /** Local id for React and the delete button. */
  id: string;
  /** Dedup key, stored in the transaction's `importKeys`. No name. */
  key: string;
  occurredAt: number;
  title: string;
  amountVnd: number;
  direction: TxDirection;
  bucketId: string;
  note: string;
  flag: RowFlag | null;
  /** A hand-entered transaction that looks like this row - to show a warning label. */
  lookalike: { bucketId: string; occurredAt: number } | null;
}

export const DEFAULT_BUCKET = 'food';

/** How far off a hand-entered transaction can be and still count as "maybe the same". */
const LOOKALIKE_WINDOW_MS = 3 * 60 * 60_000;

/** Strip accents and lowercase: 'Hoàn tiền về' -> 'hoan tien ve'. */
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
 * Money moving to your own account, not spending.
 *
 * Deliberately does NOT match plain 'nạp tiền': 'Nạp tiền điện thoại' is real spending.
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
 * 'DD/MM' + 'HH:MM' -> a timestamp in local time.
 *
 * The year comes from today. A date in the FUTURE steps back a year - a
 * January screenshot of December history. One spare day, because the device
 * clock and MoMo's may differ.
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
  // Date rolls 31/02 into March - that is a misread, not a real date.
  if (at.getDate() !== day) return null;
  if (at.getTime() > now.getTime() + 86_400_000) {
    at = new Date(now.getFullYear() - 1, month - 1, day, hour, minute);
  }
  return at.getTime();
}

/** Dedup key. Strict enough: same minute, same direction, same amount. */
export function importKey(occurredAt: number, direction: TxDirection, amountVnd: number): string {
  const d = new Date(occurredAt);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} ${direction} ${amountVnd}`;
}

/**
 * Merges the images into one list, dropping the overlap.
 *
 * Scrolling repeats the last rows of one image at the top of the next. But
 * INSIDE one image, two identical rows are two real transactions (paid twice
 * in the same minute). So each key keeps its HIGHEST count within a single
 * image, not the sum across images.
 *
 * The key has no name: the same row truncated differently in two images must
 * still match.
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

      // Only add rows when this image has MORE copies than every earlier image.
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
 * Compares with what is already in the DB.
 *
 *  - Matches the `importKeys` of an earlier import -> moved to `imported`.
 *    A certain duplicate; keeping it would count the money twice.
 *  - Looks like a HAND-ENTERED transaction (same direction, same amount, under
 *    3 hours apart) -> kept, only labeled. A 35k lunch two days running is normal.
 *
 * Each old transaction can be "used" once, so two 25k rows are not both
 * matched to one hand-entered 25k transaction.
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

/** One transaction about to be written. */
export interface ImportDraft {
  bucketId: string;
  amountVnd: number;
  direction: TxDirection;
  occurredAt: number;
  note: string | null;
  importKeys: string[];
}

/**
 * Reviewed table -> list of transactions.
 *
 * `merge`: rows WITHOUT a note are grouped by (bucket, cycle, direction) - one
 * number per bucket. Rows WITH a note stay separate, since the note only
 * makes sense for that one item.
 *
 * Grouping must split by cycle: the 24th and 25th belong to different months;
 * merged, the whole lump lands in the month of the newest row.
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
      // Integer VND sums - no floats here.
      amountVnd: list.reduce((s, r) => s + r.amountVnd, 0),
      direction: list[0].direction,
      // Time of the newest row, so the lump sits at the end of the day in History.
      occurredAt: Math.max(...list.map((r) => r.occurredAt)),
      note: `MoMo · ${list.length} payments`,
      importKeys: list.map((r) => r.key),
    });
  }

  return drafts.sort((a, b) => b.occurredAt - a.occurredAt);
}

/**
 * '-330.000đ' -> -330000. Returns null when it is not a MoMo amount.
 *
 * The model COPIES the text instead of converting it: when it converted, it
 * once read -330.000đ as -33000. Copying characters is far more accurate;
 * converting is the code's job. No sign means money out - MoMo always prints
 * '+' for money in.
 */
export function parseAmountText(text: string): number | null {
  const m = /^([+\-\u2212])?\s*(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:đ|₫|vnd)?$/i.exec(text.trim());
  if (!m) return null;
  const n = Number(m[2].replace(/[.,]/g, ''));
  if (!Number.isSafeInteger(n) || n === 0) return null;
  return m[1] === '+' ? n : -n;
}

/** Whatever the model returns goes through here. Badly shaped rows are dropped, never guessed. */
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
 * Adds new rows to a table under review - more images uploaded from another device.
 *
 * Same count rule as `mergeScreenshots`: if the table already has key K twice,
 * only the third K onward is added. Rows removed from the table count too -
 * re-uploading an old image after deleting a row does not bring it back.
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
