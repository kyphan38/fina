// ============================================================
// fina - Màu nhận dạng bucket
//
// Sáu hue, gắn theo TỪNG BUCKET chứ không theo vị trí. Đổi thứ tự hiển thị
// thì Food vẫn xanh dương - màu đi theo thực thể, không đi theo thứ hạng.
//
// Chỉ sáu hue này đã chạy qua validator mù màu. Bucket thứ bảy sẽ nhận màu
// trung tính chứ KHÔNG lặp lại một hue đã dùng: lặp là nói dối rằng hai
// bucket có quan hệ với nhau.
//
// Quỹ cố ý không có màu. Chúng đã đọc ra là nhóm khác nhờ viền nét đứt, và
// người dùng chỉ mở section đó vài lần mỗi tháng.
// ============================================================

const ACCENT: Record<string, string> = {
  food: 'var(--b1)',
  beauty: 'var(--b2)',
  social: 'var(--b3)',
  tech: 'var(--b4)',
  utilities: 'var(--b5)',
  buffer: 'var(--b6)',
};

/** Màu của bucket, hoặc màu trung tính khi nó không có màu riêng. */
export function bucketAccent(bucketId: string): string {
  return ACCENT[bucketId] ?? 'var(--muted)';
}

/** Bucket này có màu riêng không. Dùng để quyết định có vẽ vạch màu hay không. */
export function hasAccent(bucketId: string): boolean {
  return bucketId in ACCENT;
}
