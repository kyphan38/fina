'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { cancelCover, confirmCover, watchPendingCovers } from '@/lib/covers';
import { formatVnd } from '@/lib/money';
import type { Cover } from '@/types/fina';

/**
 * Reminder strip on every tab, and the place that catches the user coming
 * back after a bank transfer.
 *
 * Caught on BOTH visibilitychange and startup: iOS often kills the PWA when
 * switching to the bank app, so many "returns" are really a fresh start, and
 * visibilitychange never fires.
 */
export default function PendingCovers() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [covers, setCovers] = useState<Cover[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [returned, setReturned] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return watchPendingCovers(uid, setCovers);
  }, [uid]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setReturned(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const cover = covers[0];
  if (!uid || !cover) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(cover.amountVnd));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (http, permission) - the amount is still large on screen to type by hand.
      setCopied(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-line bg-surface-2 px-4 py-2.5">
      {/* The target is the bucket name, NOT "VCB". Covering a BIDV fund means
          the money goes to that fund; naming the wrong receiver tells the user
          to transfer to the wrong account. */}
      <p className="text-xs">
        Move <b className="font-semibold">{formatVnd(cover.amountVnd)}</b> from{' '}
        {cover.fromName} to <b className="font-semibold">{cover.toName}</b>
      </p>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs"
        >
          {copied ? 'Copied' : `Copy ${cover.amountVnd.toLocaleString('vi-VN')}`}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await confirmCover(uid, cover);
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-bg disabled:opacity-30"
        >
          {returned ? 'Transferred' : 'Done'}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => void cancelCover(uid, cover)}
          className="ml-auto text-xs text-muted"
        >
          Undo
        </button>
      </div>

      {covers.length > 1 && (
        <p className="mt-1.5 text-[11px] text-faint">
          {covers.length - 1} more waiting.
        </p>
      )}
    </div>
  );
}
