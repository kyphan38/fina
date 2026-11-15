'use client';

import { useState } from 'react';
import Link from 'next/link';

import { useAuth } from '@/contexts/AuthContext';
import { countMissing, restoreBackup, type Backup } from '@/lib/backup';
import { BACKUP_COLLECTIONS as COLLECTIONS, parseBackup } from '@/lib/restore';

type Preview = { backup: Backup; missing: Record<string, number> };

/**
 * Hidden page - only Settings links here.
 *
 * Restore ONLY ADDS missing records, matched by id. No overwrite, no delete.
 * Running it twice is safe. A "restore to exact state" would delete
 * everything written after the export - that loses data, it does not save it.
 */
export default function RestoreView() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const inspect = async (file: File) => {
    if (!uid) return;
    setMsg(null);
    try {
      const backup = parseBackup(await file.text());
      setPreview({ backup, missing: await countMissing(uid, backup) });
    } catch {
      setMsg('That file is not a fina export.');
    }
  };

  const restore = async () => {
    if (!uid || !preview) return;
    setBusy(true);
    setMsg(null);
    try {
      const added = await restoreBackup(uid, preview.backup);
      setMsg(`Restored ${added} documents. Nothing was overwritten.`);
      setPreview(null);
      setConfirm('');
    } catch (err) {
      setMsg(`Restore failed (${(err as { code?: string })?.code ?? 'unknown'}).`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none pt-6">
      <h1 className="text-xl font-semibold">Restore</h1>
      <p className="mt-2 text-sm text-muted">
        Adds missing records only. Never overwrites.
      </p>

      <input
        type="file"
        accept="application/json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void inspect(f);
        }}
        className="mt-4 w-full text-sm"
      />

      {preview && (
        <div className="mt-4 rounded-[10px] border border-line bg-surface px-4 py-3">
          <p className="text-xs text-faint">
            Exported {new Date(preview.backup.exportedAt).toLocaleString('en-GB')}
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {COLLECTIONS.map((name) => (
              <li key={name} className="flex justify-between">
                <span>{name}</span>
                <span className="text-muted">
                  {preview.missing[name]} missing of{' '}
                  {((preview.backup[name] ?? []) as unknown[]).length}
                </span>
              </li>
            ))}
          </ul>

          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type RESTORE"
            className="mt-3 w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={confirm !== 'RESTORE' || busy}
            onClick={restore}
            className="mt-2 w-full rounded-[10px] bg-ink py-2.5 text-sm font-semibold text-bg disabled:opacity-30"
          >
            {busy ? 'Restoring…' : 'Restore'}
          </button>
        </div>
      )}

      {msg && <p className="mt-4 text-sm">{msg}</p>}

      <Link href="/settings" className="mt-6 inline-block text-sm text-muted hover:text-ink active:text-ink">
        Back to Settings
      </Link>
    </section>
  );
}
