// ============================================================
// fina - Khoá màn hình Salary
//
// Đây là MÀN CHẮN, không phải bảo mật. Nó chặn người cầm điện thoại đang mở
// sẵn app, và chỉ vậy thôi. Ai có tài khoản Google của bạn vẫn đọc được số
// lương thẳng từ Firestore, không cần đi qua màn này. Muốn chặn được cả
// trường hợp đó thì phải mã hoá dữ liệu bằng khoá không nằm trong app.
//
// Mật khẩu KHÔNG nằm trong mã nguồn: chỉ có salt và chuỗi băm PBKDF2. Đọc
// được repo cũng không đọc ra được mật khẩu, chỉ có thể thử từng cái một -
// và 310.000 vòng lặp làm mỗi lần thử đắt hẳn lên.
// ============================================================

const SALT_HEX = '172594abc49406d53d8a4d437589de7f';
const ITERATIONS = 310_000;
const EXPECTED_HEX = 'b26beb93bccb8e9e9b35993a092491d9b754923800da3b95789234ebb02474a3';

/** Mở khoá sống trong TAB này thôi. Đóng tab là khoá lại. */
const SESSION_KEY = 'fina.salary.unlocked';

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): ArrayBuffer {
  const buf = new ArrayBuffer(hex.length / 2);
  const view = new Uint8Array(buf);
  for (let i = 0; i < view.length; i++) view[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return buf;
}

/**
 * So sánh trong thời gian KHÔNG phụ thuộc nội dung. `===` trên chuỗi thoát ra
 * ngay ký tự đầu khác nhau; ở đây chuyện đó gần như vô hại, nhưng viết đúng
 * một lần thì không phải nhớ ngoại lệ.
 */
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(input: string): Promise<boolean> {
  if (input === '') return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(input),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(SALT_HEX), iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return equal(toHex(bits), EXPECTED_HEX);
}

/**
 * Trạng thái mở khoá viết dạng external store, giống `prefs.ts`: đọc
 * sessionStorage trong useEffect thì server render một đằng client một nẻo,
 * và React 19 cấm setState thẳng trong effect.
 *
 * `getServer` luôn trả KHOÁ. Server không biết gì về phiên của trình duyệt,
 * và đoán sai theo hướng "đang mở" là chớp một cái hiện ra bảng lương.
 */
type Listener = () => void;

function makeGateStore() {
  const listeners = new Set<Listener>();
  let cache: boolean | undefined;

  const read = (): boolean => {
    if (cache !== undefined) return cache;
    try {
      cache = sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      // Safari chặn storage ở chế độ riêng tư. Coi như đang khoá.
      cache = false;
    }
    return cache;
  };

  const write = (next: boolean) => {
    cache = next;
    try {
      if (next) sessionStorage.setItem(SESSION_KEY, '1');
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Không nhớ được thì mỗi lần vào lại phải gõ - vẫn dùng được.
    }
    listeners.forEach((fn) => fn());
  };

  return {
    subscribe(fn: Listener) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get: read,
    getServer: () => false,
    unlock: () => write(true),
    lock: () => write(false),
  };
}

export const gateStore = makeGateStore();
