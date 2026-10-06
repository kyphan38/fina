// ============================================================
// fina - Mô tả (hint) của một hũ: hũ này gồm những gì.
//
// Tách khỏi buckets.ts để test được mà không kéo Firebase vào.
// Giới hạn độ dài phải khớp với validBucket trong firestore.rules.
// ============================================================

export const HINT_MAX_LENGTH = 200;

/**
 * Chuẩn hoá chữ người dùng gõ trước khi lưu.
 *
 * Bỏ khoảng trắng hai đầu; còn lại rỗng thì là "không có mô tả" (null), để
 * Settings hiện "No description" thay vì một bong bóng trống.
 */
export function normalizeHint(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}
