'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginView() {
  const router = useRouter();
  const { user, loading, signingIn, error, signIn } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace('/log');
  }, [loading, user, router]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">fina</h1>
        <p className="mt-1 text-sm text-muted">Personal money log</p>
      </div>

      <button
        type="button"
        onClick={signIn}
        disabled={loading || signingIn}
        className="w-full max-w-xs rounded-lg bg-ink px-4 py-3.5 text-sm font-semibold text-bg disabled:opacity-30"
      >
        {signingIn ? 'Signing in…' : 'Sign in with Google'}
      </button>

      {error && (
        <p role="alert" className="max-w-xs text-center text-sm text-over">
          {error}
        </p>
      )}
    </main>
  );
}
