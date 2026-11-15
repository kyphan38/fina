// Pure parts of Restore. The Firestore reads and writes are in lib/backup.ts.

import type { Backup } from '@/lib/backup';

export const BACKUP_COLLECTIONS = ['buckets', 'transactions', 'cycles', 'covers'] as const;
export type BackupCollection = (typeof BACKUP_COLLECTIONS)[number];

/** Firestore allows 500 writes per batch; stay well below. */
export const RESTORE_BATCH = 400;

/** Throws when the text is not a fina export. */
export function parseBackup(text: string): Backup {
  const backup = JSON.parse(text) as Backup;
  if (backup?.app !== 'fina') throw new Error('not fina');
  return backup;
}

/** Rows of the backup whose id is not in the database yet. Restore only adds. */
export function missingRows(backup: Backup, name: BackupCollection, existing: ReadonlySet<string>): Record<string, unknown>[] {
  return (backup[name] ?? []).filter((r) => !existing.has(String(r.id)));
}

export function chunks<T>(rows: readonly T[], size = RESTORE_BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
