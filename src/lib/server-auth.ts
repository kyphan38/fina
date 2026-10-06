import 'server-only';

import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';

export const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'fina_session';

export type SessionUser = {
  uid: string;
  email: string;
};

type SessionOptions = {
  /**
   * Asks Google whether the session was revoked. Safer, but costs a full
   * network round trip BEFORE the page renders.
   *
   * Default false because the (main) layout awaits this, so turning it on adds
   * straight to the wait on every app open. Real data is already guarded by
   * firestore.rules per uid; the server gate is only an extra layer for prerendering.
   *
   * Set true where the wait is worth it: costly APIs, or session-checking APIs.
   */
  checkRevoked?: boolean;
};

/**
 * Reads the session cookie and returns the user, or null if invalid.
 *
 * The allowlist is checked HERE, not only at login: a cookie can be carried
 * elsewhere, and the Firebase email can change after the cookie was issued.
 */
export async function getSessionUser(
  { checkRevoked = false }: SessionOptions = {},
): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const raw = store.get(COOKIE_NAME)?.value;
    if (!raw) return null;

    const decoded = await adminAuth.verifySessionCookie(raw, checkRevoked);

    const allowed = process.env.ALLOWED_USER_EMAIL;
    const email = decoded.email;
    if (!allowed || !email) return null;
    if (email.toLowerCase() !== allowed.toLowerCase()) return null;

    return { uid: decoded.uid, email };
  } catch {
    return null;
  }
}

/** Used in every API route. No valid session → throw. */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser({ checkRevoked: true });
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}
