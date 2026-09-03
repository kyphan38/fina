'use client';

import { useEffect, useState } from 'react';

import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';

const MESSAGE: Record<PushState, string> = {
  not_installed:
    'Add fina to your Home Screen from Safari first. iOS only delivers push to an installed app.',
  not_supported: 'This browser has no Push API.',
  blocked: 'Notifications are blocked. Turn them back on in iOS Settings → Notifications → fina.',
  no_key: 'Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY. Generate a Web Push certificate in Firebase.',
  off: 'Off',
  on: 'On',
};

export default function PushCard({ uid, quietDays }: { uid: string | null; quietDays: number }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void pushState().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canToggle = uid && (state === 'off' || state === 'on');

  return (
    <section className="rounded-xl border border-line bg-surface px-4 py-3">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
        Reminders
      </h2>

      <p className="text-sm">
        {state === null ? 'Checking…' : MESSAGE[state]}
      </p>

      {canToggle && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              if (state === 'on') {
                await disablePush(uid);
                setState('off');
              } else {
                setState(await enablePush(uid));
              }
            } finally {
              setBusy(false);
            }
          }}
          className={`mt-3 rounded-lg px-4 py-2 text-sm font-semibold ${
            state === 'on' ? 'border border-line' : 'bg-ink text-bg'
          }`}
        >
          {busy ? 'Working…' : state === 'on' ? 'Turn off' : 'Turn on'}
        </button>
      )}

      <p className="mt-3 text-xs text-faint">
        A push at 22:00 after {quietDays} quiet days. You log on 27% of days, so a daily
        nudge would fire around 266 times a year - most of them on days you genuinely
        spent nothing.
      </p>
    </section>
  );
}
