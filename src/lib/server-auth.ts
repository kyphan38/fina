import 'server-only';

import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';

export const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'fina_session';

export type SessionUser = {
  uid: string;
  email: string;
};

/**
 * Đọc session cookie và trả về user, hoặc null nếu không hợp lệ.
 *
 * Allowlist kiểm ở ĐÂY, không chỉ lúc login: cookie có thể bị mang sang chỗ
 * khác, và email trong Firebase có thể đổi sau khi cookie đã phát hành.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const raw = store.get(COOKIE_NAME)?.value;
    if (!raw) return null;

    // true = kiểm tra token đã bị thu hồi chưa.
    const decoded = await adminAuth.verifySessionCookie(raw, true);

    const allowed = process.env.ALLOWED_USER_EMAIL;
    const email = decoded.email;
    if (!allowed || !email) return null;
    if (email.toLowerCase() !== allowed.toLowerCase()) return null;

    return { uid: decoded.uid, email };
  } catch {
    return null;
  }
}

/** Dùng ở mọi API route. Không có session hợp lệ → throw. */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}
