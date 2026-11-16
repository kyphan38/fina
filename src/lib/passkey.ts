// ============================================================
// fina - Face ID / Touch ID for the Salary screen (a device passkey)
//
// Replaced the typed password on 2026-11-16 (it was forgotten and only its
// hash was in the code). Still a SCREEN GUARD, not encryption: the check runs
// on the device only. Both creating and using the passkey require the device
// owner's Face ID / Touch ID (userVerification: 'required'), so someone holding
// an unlocked phone cannot set up a new one either.
// ============================================================

/** base64url credential id of this device's passkey; absent = not set up here. */
const CRED_KEY = 'fina.salaryCred';

export function passkeySupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';
}

export function savedCredential(): string | null {
  try {
    return localStorage.getItem(CRED_KEY);
  } catch {
    return null;
  }
}

function toB64url(buf: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const challenge = () => crypto.getRandomValues(new Uint8Array(32));

/** Creates this device's passkey. Resolves false if the user cancels. */
export async function setUpPasskey(uid: string, email: string): Promise<boolean> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: challenge(),
        rp: { name: 'fina', id: location.hostname },
        user: { id: new TextEncoder().encode(uid), name: email || 'fina', displayName: 'fina salary' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem(CRED_KEY, toB64url(cred.rawId));
    return true;
  } catch {
    return false;
  }
}

/** Asks for Face ID / Touch ID with this device's passkey. */
export async function verifyPasskey(credId: string): Promise<boolean> {
  try {
    const got = await navigator.credentials.get({
      publicKey: {
        challenge: challenge(),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromB64url(credId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return got !== null;
  } catch {
    return false;
  }
}
