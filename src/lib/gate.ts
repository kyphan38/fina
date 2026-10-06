// ============================================================
// fina - Salary screen lock
//
// This is a SCREEN GUARD, not security. It stops someone holding the phone
// with the app open, and nothing more. Anyone with your Google account can
// still read salary straight from Firestore without this screen. Stopping
// that too would need data encrypted with a key that is not in the app.
//
// The password is NOT in the source: only a salt and a PBKDF2 hash. Reading
// the repo does not reveal the password, only allows guessing one by one -
// and 310,000 iterations make each guess much more expensive.
// ============================================================

const SALT_HEX = '172594abc49406d53d8a4d437589de7f';
const ITERATIONS = 310_000;
const EXPECTED_HEX = 'b26beb93bccb8e9e9b35993a092491d9b754923800da3b95789234ebb02474a3';

/** The unlock lives in THIS tab only. Closing the tab locks it. */
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
 * Compares in time that does NOT depend on content. `===` on strings exits at
 * the first different character; here that is nearly harmless, but doing it
 * right once means no exception to remember.
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
 * Unlock state as an external store, like `prefs.ts`: reading sessionStorage
 * in useEffect renders differently on server and client, and React 19
 * forbids setState directly in an effect.
 *
 * `getServer` always returns LOCKED. The server knows nothing of the browser
 * session, and guessing "open" by mistake flashes the salary table.
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
      // Safari blocks storage in private mode. Treat as locked.
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
      // If it cannot be remembered, retype each time - still usable.
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
