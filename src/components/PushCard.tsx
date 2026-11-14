'use client';

import { useEffect, useState } from 'react';

import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';
import SectionTitle from '@/components/SectionTitle';

const MESSAGE: Record<PushState, string> = {
  not_installed:
    'Add fina to your Home Screen from Safari first. iOS only delivers push to an installed app.',
  not_supported: 'This browser has no Push API.',
  blocked: 'Notifications are blocked. Turn them back on in iOS Settings › Notifications › fina.',
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
    <section className="border-t border-line pt-3">
      <SectionTitle className="mb-1">Reminders</SectionTitle>

      <p className="text-[15px]">
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
          // Settings has no main action, so no filled button here.
          className="mt-2 py-1 text-[15px] font-medium text-ink disabled:opacity-30"
        >
          {busy ? 'Working…' : state === 'on' ? 'Turn off' : 'Turn on'}
        </button>
      )}

      <p className="mt-2 text-[13px] text-faint">
        One push at 22:00 after {quietDays} quiet days.
      </p>
    </section>
  );
}
