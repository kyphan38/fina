import { collection, getDocs } from 'firebase/firestore';

import { db } from '@/lib/firebase-client';
import { cycleLabel } from '@/lib/cycle';
import { fromVnd } from '@/lib/money';

export interface Backup {
  app: 'fina';
  version: 1;
  exportedAt: number;
  uid: string;
  buckets: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  cycles: Record<string, unknown>[];
  covers: Record<string, unknown>[];
}

const readAll = async (uid: string, name: string) => {
  const snap = await getDocs(collection(db, 'users', uid, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Firestore free tier KHÔNG tự backup. Đây là toàn bộ mạng lưới an toàn,
 * nên export đọc mọi collection chứ không chỉ giao dịch.
 */
export async function buildBackup(uid: string): Promise<Backup> {
  const [buckets, transactions, cycles, covers] = await Promise.all([
    readAll(uid, 'buckets'),
    readAll(uid, 'transactions'),
    readAll(uid, 'cycles'),
    readAll(uid, 'covers'),
  ]);
  return { app: 'fina', version: 1, exportedAt: Date.now(), uid, buckets, transactions, cycles, covers };
}

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * CSV để mở bằng Numbers/Excel. `Month` và `Year` sinh ra từ `cycle` lúc
 * export - không lưu trong DB, nên chúng không bao giờ mâu thuẫn với nhau.
 */
export function toCsv(backup: Backup): string {
  const names = new Map(backup.buckets.map((b) => [b.id as string, String(b.name ?? b.id)]));
  const head = ['Cycle', 'Month', 'Year', 'Date', 'Bucket', 'Bank', 'Amount', 'Note'];

  const rows = [...backup.transactions]
    .sort((a, b) => Number(b.occurredAt) - Number(a.occurredAt))
    .map((t) => {
      const cycle = String(t.cycle ?? '');
      let month = '';
      let year = '';
      try {
        const l = cycleLabel(cycle);
        month = l.month;
        year = String(l.year);
      } catch {
        // Chu kỳ hỏng thì để trống, đừng làm hỏng cả file export.
      }
      return [
        cycle,
        month,
        year,
        new Date(Number(t.occurredAt)).toISOString(),
        names.get(String(t.bucketId)) ?? String(t.bucketId),
        String(t.bank ?? ''),
        fromVnd(Number(t.amountVnd ?? 0)),
        String(t.note ?? ''),
      ].map(esc).join(',');
    });

  return [head.join(','), ...rows].join('\n');
}

export function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Ngày export gần nhất, để nhắc khi quá lâu. */
const LAST_EXPORT_KEY = 'fina.lastExport';

export function markExported(): void {
  try {
    localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function daysSinceExport(): number | null {
  try {
    const raw = localStorage.getItem(LAST_EXPORT_KEY);
    if (!raw) return null;
    return Math.floor((Date.now() - Number(raw)) / 86_400_000);
  } catch {
    return null;
  }
}
