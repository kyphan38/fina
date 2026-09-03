'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';

import { useAuth } from '@/contexts/AuthContext';
import { seedBuckets, updateBucket, watchBuckets } from '@/lib/buckets';
import { fromVnd, toVnd } from '@/lib/money';
import { clearStartupTimes, readSkippedCount, startupStore } from '@/lib/startup';
import { buildBackup, daysSinceExport, download, markExported, toCsv } from '@/lib/backup';
import PushCard from '@/components/PushCard';
import { REMINDER_QUIET_DAYS } from '@/types/fina';
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
      setMsg(result === 'seeded' ? 'Buckets created.' : 'Buckets already exist - nothing changed.');
    } catch (err) {
      // Hiện nguyên mã lỗi Firestore. 'permission-denied' nghĩa là rules từ
      // chối dữ liệu, không phải mất mạng - hai chuyện cần sửa khác hẳn nhau.
      const code = (err as { code?: string })?.code ?? 'unknown';
      setMsg(`Could not write buckets (${code}).`);
    } finally {
      setBusy(false);
    }
  };

  const [exporting, setExporting] = useState(false);
  const [openHint, setOpenHint] = useState<string | null>(null);
  const stale = daysSinceExport();
  const skipped = readSkippedCount();

  const exportAs = async (kind: 'json' | 'csv') => {
    if (!uid) return;
    setExporting(true);
    try {
      const backup = await buildBackup(uid);
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === 'json') {
        download(`fina-${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json');
      } else {
        download(`fina-${stamp}.csv`, toCsv(backup), 'text/csv');
      }
      markExported();
    } catch {
      setMsg('Could not build the export.');
    } finally {
      setExporting(false);
    }
  };

  const saveStandard = async (bucket: Bucket, raw: string) => {
    if (!uid) return;
    const trimmed = raw.trim();
    // 0 là giá trị hợp lệ cho standard (ETF), nhưng toVnd() từ chối số 0 vì
    // nó dùng cho số tiền giao dịch. Xử lý riêng ở đây.
    const vnd = trimmed === '0' || trimmed === '' ? 0 : toVnd(trimmed);
    if (vnd === null || vnd === bucket.standardVnd) return;
    await updateBucket(uid, bucket.id, { standardVnd: vnd });
  };

  return (
    <div className="mt-4 flex flex-col gap-5">
      <Card title="Signed in as">
        <p className="text-sm">{email ?? '-'}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 rounded-lg border border-line px-4 py-2 text-sm font-medium"
        >
          Sign out
        </button>
      </Card>

      <Card title="Standard amounts">
        <p className="mb-3 text-sm text-muted">
          Your normal amounts. They open each new cycle and fill in the Generator, and
          they should hardly ever change. To adjust one month only, edit it in the
          Generator or use <span className="font-medium text-ink">Edit limits</span> on
          Summary.
        </p>

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
          <>
          <p className="mb-2 text-[11px] text-faint">Tap a name to see what belongs in it.</p>
          <ul className="flex flex-col divide-y divide-line">
            {buckets.map((b) => (
              <li key={b.id} className="relative py-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenHint(openHint === b.id ? null : b.id)}
                    aria-expanded={openHint === b.id}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="truncate text-sm">{b.name}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-faint">
                      {b.bank}
                    </span>
                  </button>
                  <input
                    defaultValue={fromVnd(b.standardVnd)}
                    inputMode="decimal"
                    aria-label={`${b.name} standard`}
                    onBlur={(e) => saveStandard(b, e.target.value)}
                    className="w-24 shrink-0 rounded-md border border-line bg-surface-2 px-2 py-1 text-right text-sm"
                  />
                </div>

                {/* Bong bóng chỉa lên đúng cái tên vừa bấm. Chỉ hiện khi hỏi,
                    nên không chiếm chỗ của 11 dòng còn lại. */}
                {openHint === b.id && b.hint && (
                  <div className="relative mt-2 rounded-lg bg-ink px-3 py-2 text-[12px] text-bg">
                    <span aria-hidden className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-ink" />
                    {b.hint}
                  </div>
                )}
              </li>
            ))}
          </ul>
          </>
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
              Measured to the frame the keypad is painted, and only while the app stayed
              visible the whole time. Waking a suspended app is not a page load, so those
              runs are dropped{skipped > 0 ? ` - ${skipped} so far` : ''}. Target: 1.50s
              warm, 2.50s after iOS kills the app.
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

      <PushCard uid={uid} quietDays={REMINDER_QUIET_DAYS} />

      <Card title="Backup">
        <p className="mb-3 text-sm text-muted">
          Firestore does not back this up for you. Export is the whole safety net.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!uid || exporting}
            onClick={() => exportAs('json')}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg disabled:opacity-30"
          >
            {exporting ? 'Reading…' : 'Export JSON'}
          </button>
          <button
            type="button"
            disabled={!uid || exporting}
            onClick={() => exportAs('csv')}
            className="rounded-lg border border-line px-4 py-2 text-sm disabled:opacity-30"
          >
            Export CSV
          </button>
        </div>
        {stale !== null && stale >= 35 && (
          <p className="mt-3 text-xs text-over">Last export was {stale} days ago.</p>
        )}
        <p className="mt-3 text-xs text-faint">
          Restoring is at{' '}
          <Link href="/settings/restore" className="underline">
            /settings/restore
          </Link>
          . It only adds what is missing - it never overwrites or deletes.
        </p>
      </Card>

      <p className="text-xs text-muted">
        Stage 4. Reminders and AI insights arrive later.
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
