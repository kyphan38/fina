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
 * Firestore's free tier does NOT back up. This is the whole safety net,
 * so export reads every collection, not just transactions.
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
 * CSV for Numbers/Excel. `Month` and `Year` come from `cycle` at export time -
 * not stored in the DB, so they never disagree.
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
        // A broken cycle stays empty; never break the whole export file.
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

/** Date of the last export, to remind when it gets too old. */
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
