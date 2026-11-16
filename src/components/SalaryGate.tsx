'use client';

import { useState, useSyncExternalStore } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { gateStore } from '@/lib/gate';
import { passkeySupported, savedCredential, setUpPasskey, verifyPasskey } from '@/lib/passkey';

const noop = () => () => {};

/**
 * Gate in front of Salary: Face ID / Touch ID with a device passkey.
 * A device without one sets it up first (that also asks for Face ID).
 */
export default function SalaryGate() {
  const { user } = useAuth();
  const supported = useSyncExternalStore(noop, passkeySupported, () => false);
  const [cred, setCred] = useState<string | null>(() => (typeof window === 'undefined' ? null : savedCredential()));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    setFailed(false);
    const ok = await fn();
    setBusy(false);
    if (ok) gateStore.unlock();
    else setFailed(true);
  };

  const setUp = () =>
    run(async () => {
      const ok = await setUpPasskey(user?.uid ?? 'fina', user?.email ?? '');
      setCred(savedCredential());
      return ok;
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center pb-16">
      <div className="w-full max-w-[280px] text-center">
        <p className="text-xs text-faint">Locked</p>
        {!supported ? (
          <p className="mt-2 text-sm text-muted">Face ID is not available here.</p>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => (cred ? run(() => verifyPasskey(cred)) : setUp())}
              className="mt-2 w-full rounded-[10px] bg-ink py-2.5 text-sm font-semibold text-bg disabled:opacity-30"
            >
              {busy ? 'Checking…' : cred ? 'Unlock' : 'Set up Face ID'}
            </button>
            {failed && <p className="mt-2 text-xs font-medium text-over">Not unlocked.</p>}
            {cred && failed && (
              <button type="button" onClick={setUp} className="mt-1 text-xs text-faint hover:text-ink">
                set up again
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
