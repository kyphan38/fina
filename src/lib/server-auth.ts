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
   * Hỏi Google xem phiên đã bị thu hồi chưa. Chắc chắn hơn, nhưng tốn trọn một
   * vòng gọi mạng TRƯỚC KHI trang được render.
   *
   * Mặc định false vì layout của (main) await hàm này, nên bật lên là cộng thẳng
   * vào thời gian chờ mỗi lần mở app. Dữ liệu thật đã có firestore.rules chặn
   * theo uid; cổng server chỉ là lớp phụ cho phần render sẵn.
   *
   * Bật true ở nơi nào đáng để chờ: API tốn tiền, hoặc API kiểm tra phiên.
   */
  checkRevoked?: boolean;
};

/**
 * Đọc session cookie và trả về user, hoặc null nếu không hợp lệ.
 *
 * Allowlist kiểm ở ĐÂY, không chỉ lúc login: cookie có thể bị mang sang chỗ
 * khác, và email trong Firebase có thể đổi sau khi cookie đã phát hành.
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

/** Dùng ở mọi API route. Không có session hợp lệ → throw. */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser({ checkRevoked: true });
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}
