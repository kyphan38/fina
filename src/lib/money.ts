// ============================================================
// fina - Tiền
//
// DB lưu SỐ NGUYÊN VND. Người dùng gõ và đọc theo NGHÌN.
//   gõ  "25"      -> 25_000 đ
//   gõ  "155.36"  -> 155_360 đ
//   hiện 155_360  -> "155,36"   (locale VN: '.' nhóm nghìn, ',' thập phân)
//
// Lý do không lưu số thực: cộng nhiều float sẽ trôi
// (25.3 + 155.36 + 5020.4 = 5201.060000000001) và không sửa lại được.
// ============================================================

/** 1 đơn vị người dùng gõ = 1.000 đ */
const UNIT = 1000;

/** .001 nghìn = 1 đ. Không có mệnh giá nào nhỏ hơn. */
const MAX_DECIMALS = 3;

/**
 * Đọc chuỗi người dùng gõ thành số nguyên VND.
 * Nhận cả '.' và ',' làm dấu thập phân - bàn phím iOS tiếng Việt ép dùng ','.
 * Trả null khi không phải số hợp lệ, hoặc bằng 0.
 */
export function toVnd(input: string): number | null {
  const raw = input.trim().replace(',', '.');
  if (raw === '' || raw === '.') return null;
  if (!/^\d*\.?\d*$/.test(raw)) return null;

  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;

  // '0.0004' là số dương hợp lệ nhưng làm tròn về 0đ. Một giao dịch 0 đồng
  // không có nghĩa gì, và Firestore rules cũng chặn amountVnd <= 0.
  const vnd = Math.round(n * UNIT);
  return vnd > 0 ? vnd : null;
}

/**
 * Số nguyên VND -> chuỗi để gõ lại / round-trip. Dùng dấu '.' thập phân,
 * không nhóm nghìn. 155_360 -> '155.36'
 */
export function fromVnd(vnd: number): string {
  const units = vnd / UNIT;
  // toFixed rồi cắt số 0 thừa: 155.360 -> '155.36', 25.000 -> '25'
  return units
    .toFixed(MAX_DECIMALS)
    .replace(/\.?0+$/, '');
}

/**
 * Số nguyên VND -> chuỗi hiển thị theo locale VN.
 * 155_360 -> '155,36' ; 2_975_000 -> '2.975' ; -300_000 -> '-300'
 */
export function formatVnd(vnd: number): string {
  return (vnd / UNIT).toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: MAX_DECIMALS,
  });
}

/**
 * Nối thêm một phím từ numpad vào chuỗi đang gõ.
 * Giữ toàn bộ luật gõ ở một chỗ để component không phải biết gì về tiền.
 */
export function pressKey(current: string, key: string): string {
  if (key === 'del') return current.slice(0, -1);

  if (key === '.') {
    if (current === '' || current.includes('.')) return current;
    return `${current}.`;
  }

  if (!/^\d$/.test(key)) return current;

  const [whole, decimals] = current.split('.');
  // Chặn ngay lúc gõ, không đợi tới lúc lưu mới làm tròn sau lưng người dùng.
  if (decimals !== undefined && decimals.length >= MAX_DECIMALS) return current;
  if (decimals === undefined && whole.length >= 7) return current;
  // '0' -> '05' là vô nghĩa; thay luôn.
  if (current === '0') return key;

  return current + key;
}
