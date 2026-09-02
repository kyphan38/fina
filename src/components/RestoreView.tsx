'use client';

import { useState } from 'react';
import Link from 'next/link';
import { doc, getDocs, writeBatch, collection } from 'firebase/firestore';

import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase-client';
import type { Backup } from '@/lib/backup';

type Preview = { backup: Backup; missing: Record<string, number> };

const COLLECTIONS = ['buckets', 'transactions', 'cycles', 'covers'] as const;

/**
 * Trang ẩn - không có link nào trỏ tới ngoài Settings.
 *
 * Restore CHỈ THÊM bản ghi còn thiếu, khớp theo id. Không ghi đè, không xoá.
 * Chạy hai lần là an toàn. Một restore "khôi phục nguyên trạng" sẽ xoá mất
 * mọi thứ ghi sau lần export - đó là cách mất dữ liệu, không phải cách cứu.
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
      const backup: Backup = JSON.parse(await file.text());
      if (backup.app !== 'fina') throw new Error('not fina');

      const missing: Record<string, number> = {};
      for (const name of COLLECTIONS) {
        const existing = new Set(
          (await getDocs(collection(db, 'users', uid, name))).docs.map((d) => d.id),
        );
        const rows = (backup[name] ?? []) as { id: string }[];
        missing[name] = rows.filter((r) => !existing.has(r.id)).length;
      }
      setPreview({ backup, missing });
    } catch {
      setMsg('That file is not a fina export.');
    }
  };

  const restore = async () => {
    if (!uid || !preview) return;
    setBusy(true);
    setMsg(null);
    try {
      let added = 0;
      for (const name of COLLECTIONS) {
        const existing = new Set(
          (await getDocs(collection(db, 'users', uid, name))).docs.map((d) => d.id),
        );
        const rows = ((preview.backup[name] ?? []) as Record<string, unknown>[]).filter(
          (r) => !existing.has(String(r.id)),
        );
        for (let i = 0; i < rows.length; i += 400) {
          const batch = writeBatch(db);
          for (const r of rows.slice(i, i + 400)) {
            const { id, ...rest } = r;
            batch.set(doc(db, 'users', uid, name, String(id)), rest);
            added++;
          }
          await batch.commit();
        }
      }
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
    <section className="min-h-0 flex-1 overflow-y-auto pt-6">
      <h1 className="text-lg font-semibold">Restore</h1>
      <p className="mt-2 text-sm text-muted">
        Adds only the records that are missing, matched by id. Never overwrites, never
        deletes. Running it twice is safe.
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
        <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-3">
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
            className="mt-3 w-full rounded-[9px] border border-line bg-surface-2 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={confirm !== 'RESTORE' || busy}
            onClick={restore}
            className="mt-2 w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-bg disabled:opacity-30"
          >
            {busy ? 'Restoring…' : 'Restore'}
          </button>
        </div>
      )}

      {msg && <p className="mt-4 text-sm">{msg}</p>}

      <Link href="/settings" className="mt-6 inline-block text-sm underline">
        Back to Settings
      </Link>
    </section>
  );
}
