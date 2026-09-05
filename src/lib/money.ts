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

/** Khoản đang gõ dở - phần sau dấu cộng/trừ cuối cùng. */
function lastTerm(s: string): string {
  const at = Math.max(s.lastIndexOf('+'), s.lastIndexOf('-'));
  return at === -1 ? s : s.slice(at + 1);
}

/**
 * Nối thêm một phím từ numpad vào chuỗi đang gõ.
 * Giữ toàn bộ luật gõ ở một chỗ để component không phải biết gì về tiền.
 *
 * Mọi giới hạn (số chữ số, một dấu thập phân) áp cho TỪNG khoản, không cho
 * cả chuỗi: '25.5+3.2' là hai khoản hợp lệ, không phải một số có hai dấu chấm.
 */
export function pressKey(current: string, key: string): string {
  if (key === 'del') return current.slice(0, -1);

  if (key === '+' || key === '-') {
    // Không mở đầu bằng dấu: ô số là một khoản tiền, không phải số âm.
    if (current === '') return current;
    // Vừa gõ dấu rồi lại gõ dấu khác = đổi ý, thay chứ không nối thêm.
    if (/[+-]$/.test(current)) return current.slice(0, -1) + key;
    // '25.' chưa phải một khoản xong xuôi.
    if (current.endsWith('.')) return current;
    return current + key;
  }

  if (key === '.') {
    const term = lastTerm(current);
    if (term === '' || term.includes('.')) return current;
    return `${current}.`;
  }

  if (!/^\d$/.test(key)) return current;

  const term = lastTerm(current);
  const [whole, decimals] = term.split('.');
  // Chặn ngay lúc gõ, không đợi tới lúc lưu mới làm tròn sau lưng người dùng.
  if (decimals !== undefined && decimals.length >= MAX_DECIMALS) return current;
  if (decimals === undefined && whole.length >= 7) return current;
  // '0' -> '05' là vô nghĩa; thay luôn.
  if (term === '0') return current.slice(0, -1) + key;

  return current + key;
}

/** Một khoản lẻ trong biểu thức. Cho phép 0, khác `toVnd`. */
function termToVnd(term: string): number | null {
  const raw = term.trim();
  if (raw === '' || raw === '.') return null;
  if (!/^\d*\.?\d*$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * UNIT);
}

/**
 * Gộp nhiều khoản nhỏ trong MỘT lần gõ: '25+30.5-4' -> 51.500đ.
 *
 * Ba cốc cà phê một buổi sáng là ba lần mở app; gõ '25+30+18' là một lần.
 *
 * Cộng theo SỐ NGUYÊN VND, làm tròn từng khoản TRƯỚC khi cộng - không cộng
 * số thực rồi mới nhân 1000. 0.1 + 0.2 trong JS ra 0.30000000000000004, và
 * tiền thì không được phép trôi (xem đầu file).
 *
 * Trả null khi chuỗi chưa hoàn chỉnh ('25+'), sai định dạng, hoặc tổng <= 0 -
 * cùng quy ước với `toVnd`, nên nút Save tự khoá cho tới khi gõ xong.
 */
export function evalAmount(input: string): number | null {
  const raw = input.trim().replace(/,/g, '.');
  if (raw === '') return null;
  if (/^[+-]/.test(raw)) return null;

  let total = 0;
  // Tách nhưng GIỮ dấu: '25+30-4' -> ['25', '+30', '-4']
  for (const part of raw.split(/(?=[+-])/)) {
    const signed = /^[+-]/.test(part);
    const value = termToVnd(signed ? part.slice(1) : part);
    if (value === null) return null;
    total += (part.startsWith('-') ? -1 : 1) * value;
  }
  return total > 0 ? total : null;
}
