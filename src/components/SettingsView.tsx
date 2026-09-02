'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { seedBuckets, updateBucket, watchBuckets } from '@/lib/buckets';
import { formatVnd, fromVnd, toVnd } from '@/lib/money';
import { clearStartupTimes, startupStore } from '@/lib/startup';
import type { Bucket } from '@/types/fina';

export default function SettingsView({ email }: { email: string | null }) {
  const { user, signOut } = useAuth();
  const uid = user?.uid ?? null;

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const times = useSyncExternalStore(
    startupStore.subscribe,
    startupStore.get,
    startupStore.getServer,
  );

  useEffect(() => {
    if (!uid) return;
    return watchBuckets(uid, setBuckets);
  }, [uid]);

  const initialize = async () => {
    if (!uid) return;
    setBusy(true);
    try {
      const result = await seedBuckets(uid);
      setMsg(result === 'seeded' ? 'Buckets created.' : 'Buckets already exist — nothing changed.');
    } catch (err) {
      // Hiện nguyên mã lỗi Firestore. 'permission-denied' nghĩa là rules từ
      // chối dữ liệu, không phải mất mạng - hai chuyện cần sửa khác hẳn nhau.
      const code = (err as { code?: string })?.code ?? 'unknown';
      setMsg(`Could not write buckets (${code}).`);
    } finally {
      setBusy(false);
    }
  };

  const saveBaseline = async (bucket: Bucket, raw: string) => {
    if (!uid) return;
    const trimmed = raw.trim();
    // 0 là giá trị hợp lệ cho baseline (Reserve, ETF), nhưng toVnd() từ chối
    // số 0 vì nó dùng cho số tiền giao dịch. Xử lý riêng ở đây.
    const vnd = trimmed === '0' || trimmed === '' ? 0 : toVnd(trimmed);
    if (vnd === null || vnd === bucket.baselineVnd) return;
    await updateBucket(uid, bucket.id, { baselineVnd: vnd });
  };

  return (
    <div className="mt-4 flex flex-col gap-5">
      <Card title="Signed in as">
        <p className="text-sm">{email ?? '—'}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 rounded-lg border border-line px-4 py-2 text-sm font-medium"
        >
          Sign out
        </button>
      </Card>

      <Card title="Buckets">
        {buckets.length === 0 ? (
          <>
            <p className="mb-3 text-sm text-muted">
              No buckets yet. This writes the twelve starting buckets. Running it again
              changes nothing.
            </p>
            <button
              type="button"
              onClick={initialize}
              disabled={busy || !uid}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg disabled:opacity-30"
            >
              {busy ? 'Writing…' : 'Initialize buckets'}
            </button>
          </>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {buckets.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-2">
                <span className="w-28 shrink-0 text-sm">{b.name}</span>
                <span className="w-12 shrink-0 text-[10px] uppercase tracking-wider text-faint">
                  {b.bank}
                </span>
                <input
                  defaultValue={fromVnd(b.baselineVnd)}
                  inputMode="decimal"
                  aria-label={`${b.name} baseline`}
                  onBlur={(e) => saveBaseline(b, e.target.value)}
                  className="w-24 rounded-md border border-line bg-surface-2 px-2 py-1 text-right text-sm"
                />
                {b.kind === 'fund' && (
                  <span className="ml-auto text-xs text-muted">{formatVnd(b.balanceVnd)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {msg && <p className="mt-3 text-xs text-muted">{msg}</p>}
      </Card>

      <Card title="Cold start">
        {times.length === 0 ? (
          <p className="text-sm text-muted">
            No measurement yet. Open the Log tab once.
          </p>
        ) : (
          <>
            <p className="text-sm">
              <b className="text-lg font-semibold">{(times[0].ms / 1000).toFixed(2)}s</b>{' '}
              <span className="text-muted">
                last · {times[0].network ? 'from network' : 'from cache'}
              </span>
            </p>
            <ul className="mt-2 flex flex-col gap-0.5 text-xs text-muted">
              {times.map((t) => (
                <li key={t.at} className="flex justify-between">
                  <span>{(t.ms / 1000).toFixed(2)}s</span>
                  <span className="text-faint">
                    {t.network ? 'network' : 'cache'} ·{' '}
                    {new Date(t.at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-faint">
              Measured to the frame the keypad is on screen, not to your first tap.
              Target: 1.50s warm, 2.50s after iOS kills the app.
            </p>
            <button
              type="button"
              onClick={clearStartupTimes}
              className="mt-3 rounded-lg border border-line px-3 py-1.5 text-xs"
            >
              Reset
            </button>
          </>
        )}
      </Card>

      <p className="text-xs text-muted">
        Stage 2. Cycle settings, reminders and export arrive later.
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface px-4 py-3">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
        {title}
      </h2>
      {children}
    </section>
  );
}
