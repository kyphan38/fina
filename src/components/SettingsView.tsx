'use client';

import { useAuth } from '@/contexts/AuthContext';

export default function SettingsView({ email }: { email: string | null }) {
  const { signOut } = useAuth();

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="rounded-xl border border-line bg-surface px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
          Signed in as
        </p>
        <p className="mt-1 text-sm">{email ?? '—'}</p>
      </div>

      <button
        type="button"
        onClick={signOut}
        className="self-start rounded-lg border border-line px-4 py-2.5 text-sm font-medium"
      >
        Sign out
      </button>

      <p className="text-xs text-muted">
        Stage 1. Buckets, cycle settings and reminders arrive in Stage 2.
      </p>
    </div>
  );
}
