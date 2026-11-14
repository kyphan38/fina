'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';

import { useAuth } from '@/contexts/AuthContext';
import { seedBuckets, updateBucket, watchBuckets } from '@/lib/buckets';
import { HINT_MAX_LENGTH, normalizeHint } from '@/lib/bucket-hint';
import { fromVnd, toVnd } from '@/lib/money';
import { clearStartupTimes, readSkippedCount, startupStore } from '@/lib/startup';
import { buildBackup, daysSinceExport, download, markExported, toCsv } from '@/lib/backup';
import { themeStore, type Theme } from '@/lib/prefs';
import PushCard from '@/components/PushCard';
import SectionTitle, { WORD, WORD_GO } from '@/components/SectionTitle';
import GoalsCard from '@/components/GoalsCard';
import { isGoal } from '@/lib/goals';
import { REMINDER_QUIET_DAYS } from '@/types/fina';
import BucketDot from '@/components/BucketDot';
import type { Bucket } from '@/types/fina';

export default function SettingsView() {
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
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.get, themeStore.getServer);

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
      // Show the raw Firestore error code. 'permission-denied' means the rules
      // rejected the data, not a network problem - two very different fixes.
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
    // 0 is a valid standard (ETF), but toVnd() rejects 0 because it is meant
    // for transaction amounts. Handled separately here.
    const vnd = trimmed === '0' || trimmed === '' ? 0 : toVnd(trimmed);
    if (vnd === null || vnd === bucket.standardVnd) return;
    await updateBucket(uid, bucket.id, { standardVnd: vnd });
  };

  return (
    <div className="mt-5 flex flex-col gap-8">
      <Card title="Signed in as">
        <p className="text-[15px]">{user?.email ?? '-'}</p>
        <button type="button" onClick={signOut} className={`${WORD} mt-2 py-1`}>
          Sign out
        </button>
      </Card>

      <Card title="Theme">
        {/* The current choice is bold, the others are faint and clickable. */}
        <div className="flex gap-4 text-[15px]" role="radiogroup" aria-label="Theme">
          {(['system', 'light', 'dark'] as const satisfies readonly Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={theme === t}
              onClick={() => themeStore.set(t)}
              className={theme === t ? 'font-medium text-ink' : 'text-faint'}
            >
              {t}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Standard amounts">
        <p className="mb-2 text-[13px] text-muted">
          Defaults for each new cycle. For one month only, use Generator.
        </p>

        {buckets.length === 0 ? (
          <>
            <p className="mb-3 text-[15px] text-muted">
              No buckets yet. Creates the 12 starting ones.
            </p>
            <button
              type="button"
              onClick={initialize}
              disabled={busy || !uid}
              className="rounded-[10px] bg-ink px-4 py-2.5 text-[15px] font-semibold text-bg disabled:opacity-30"
            >
              {busy ? 'Writing…' : 'Initialize buckets'}
            </button>
          </>
        ) : (
          <>
          <p className="text-[13px] text-faint">Tap a name to edit.</p>
          <ul className="flex flex-col divide-y divide-line">
            {/* Goals have their own card below. */}
            {buckets.filter((b) => !isGoal(b)).map((b) => (
              <li key={b.id} className="relative py-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenHint(openHint === b.id ? null : b.id)}
                    aria-expanded={openHint === b.id}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <BucketDot id={b.id} keepSpace />
                    <span className="truncate text-[15px]">{b.name}</span>
                    <span className="shrink-0 text-[11px] text-faint">{b.bank}</span>
                  </button>
                  <input
                    defaultValue={fromVnd(b.standardVnd)}
                    inputMode="decimal"
                    aria-label={`${b.name} standard`}
                    onBlur={(e) => saveStandard(b, e.target.value)}
                    className="w-24 shrink-0 rounded-md border border-line bg-surface-2 px-2 py-1 text-right text-[15px]"
                  />
                </div>

                {/* The bubble points up at the name just tapped. Only shown when
                    asked, so it takes no room from the other 11 rows. */}
                {openHint === b.id && uid && <HintBubble uid={uid} bucket={b} />}
              </li>
            ))}
          </ul>
          </>
        )}
        {msg && <p className="mt-3 text-[13px] text-muted">{msg}</p>}
      </Card>

      {uid && buckets.length > 0 && <GoalsCard uid={uid} buckets={buckets} />}

      <PushCard uid={uid} quietDays={REMINDER_QUIET_DAYS} />

      <Card title="Backup">
        <p className="text-[15px]">Export is your only backup.</p>
        {/* Words, not a filled button: Settings has no main action. */}
        <div className="mt-2 flex items-baseline gap-5 text-[15px]">
          <button
            type="button"
            disabled={!uid || exporting}
            onClick={() => exportAs('json')}
            className="py-1 font-medium text-ink disabled:opacity-30"
          >
            {exporting ? 'Reading…' : 'Export JSON'}
          </button>
          <button
            type="button"
            disabled={!uid || exporting}
            onClick={() => exportAs('csv')}
            className="py-1 font-medium text-ink disabled:opacity-30"
          >
            Export CSV
          </button>
          <Link href="/settings/restore" className={WORD_GO}>
            Restore
          </Link>
        </div>
        {stale !== null && stale >= 35 && (
          <p className="mt-2 text-[13px] font-medium text-over">Last export was {stale} days ago.</p>
        )}
      </Card>

      {/* No tab in the bottom bar and no hint of what it holds: someone holding
          the phone while the app is open never sees the word "salary".
          That page locks itself with a password. */}
      <p className="flex gap-5">
        <Link href="/guide" className={WORD_GO}>
          Guide
        </Link>
        <Link href="/salary" className={WORD_GO}>
          More
        </Link>
      </p>

      {/* A tool for the owner, not a setting: one faint line, details on tap. */}
      <ColdStart times={times} skipped={skipped} />
    </div>
  );
}

/**
 * A bucket's description: read it in the bubble, tap Edit to change it.
 * Writes only `hint`; cycles, entries and balances are untouched.
 */
function HintBubble({ uid, bucket }: { uid: string; bucket: Bucket }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Focus with the caret at the end: editing usually means adding a word.
  useEffect(() => {
    const el = inputRef.current;
    if (!editing || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const startEdit = () => {
    setDraft(bucket.hint ?? '');
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    const next = normalizeHint(draft);
    if (next === bucket.hint) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateBucket(uid, bucket.id, { hint: next });
      setEditing(false);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? 'unknown';
      setError(`Could not save (${code}).`);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="relative mt-2 flex items-start gap-3 rounded-[10px] bg-ink px-3 py-2 text-[12px] text-bg">
        <span aria-hidden className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-ink" />
        <span className={`min-w-0 flex-1 ${bucket.hint ? '' : 'opacity-60'}`}>
          {bucket.hint ?? 'No description'}
        </span>
        <button
          type="button"
          onClick={startEdit}
          aria-label={`Edit description of ${bucket.name}`}
          className="shrink-0 font-medium"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false);
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save();
        }}
        maxLength={HINT_MAX_LENGTH}
        rows={2}
        ref={inputRef}
        aria-label={`Description of ${bucket.name}`}
        placeholder="What belongs in this bucket"
        className="w-full resize-none rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm"
      />
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-[10px] bg-ink px-3 py-1.5 text-xs font-semibold text-bg disabled:opacity-30"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="py-1.5 text-xs text-muted hover:text-ink active:text-ink disabled:opacity-30"
        >
          Cancel
        </button>
        <span className="ml-auto text-[11px] text-faint">
          {HINT_MAX_LENGTH - draft.length} left
        </span>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-over">{error}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-3">
      <SectionTitle className="mb-1">{title}</SectionTitle>
      {children}
    </section>
  );
}

function ColdStart({
  times,
  skipped,
}: {
  times: ReturnType<typeof startupStore.get>;
  skipped: number;
}) {
  const [open, setOpen] = useState(false);
  const last = times[0];
  return (
    <section className="-mt-4 text-[13px] text-faint">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={WORD}>
        Cold start{' '}
        {last ? `${(last.ms / 1000).toFixed(2)}s · ${last.network ? 'network' : 'cache'}` : 'not measured'}
      </button>
      {open && (
        <div className="mt-2">
          {times.length === 0 ? (
            <p>No measurement yet. Open the Log tab once.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {times.map((t) => (
                <li key={t.at} className="flex justify-between">
                  <span className="text-muted">{(t.ms / 1000).toFixed(2)}s</span>
                  <span>
                    {t.network ? 'network' : 'cache'} ·{' '}
                    {new Date(t.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2">
            Target: 1.50s warm, 2.50s cold.{skipped > 0 ? ` ${skipped} runs dropped.` : ''}
          </p>
          <button type="button" onClick={clearStartupTimes} className={`${WORD} mt-1 py-1`}>
            Reset
          </button>
        </div>
      )}
    </section>
  );
}
