/**
 * Collabify end-to-end encryption (runs in the browser; also importable from Node 20+).
 *
 * - Each user has an ECDH P-256 keypair generated on their device at sign-up.
 * - The public key is shared via the server. The private key is wrapped (AES-GCM) with a key
 *   derived from the user's password (PBKDF2-SHA256, 310k iterations) before upload, so the
 *   server only ever stores an encrypted blob it cannot open.
 * - Two users derive the same AES-256-GCM conversation key via ECDH; every message gets a
 *   fresh random 96-bit IV.
 */
const subtle = globalThis.crypto.subtle;
const PBKDF2_ITERATIONS = 310_000;

const toB64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const enc = new TextEncoder();
const dec = new TextDecoder();

async function passwordKey(password, salt) {
  const base = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Generate a new identity keypair, returning the public key and the password-wrapped private key. */
export async function createIdentity(password) {
  const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const publicKey = toB64(await subtle.exportKey('spki', pair.publicKey));
  const pkcs8 = await subtle.exportKey('pkcs8', pair.privateKey);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const wrapKey = await passwordKey(password, salt);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, pkcs8);
  const wrappedPrivateKey = btoa(JSON.stringify({ v: 1, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) }));
  return { publicKey, wrappedPrivateKey, privateKey: pair.privateKey };
}

/** Unwrap the private key with the user's password. Throws if the password is wrong. */
export async function unwrapPrivateKey(wrappedPrivateKey, password) {
  const { salt, iv, ct } = JSON.parse(atob(wrappedPrivateKey));
  const wrapKey = await passwordKey(password, fromB64(salt));
  const pkcs8 = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, wrapKey, fromB64(ct));
  return subtle.importKey('pkcs8', pkcs8, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
}

export async function exportPrivateKey(privateKey) {
  return toB64(await subtle.exportKey('pkcs8', privateKey));
}

export async function importPrivateKey(b64) {
  return subtle.importKey('pkcs8', fromB64(b64), { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
}

export async function conversationKey(myPrivateKey, theirPublicKeyB64) {
  const theirs = await subtle.importKey('spki', fromB64(theirPublicKeyB64), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  return subtle.deriveKey({ name: 'ECDH', public: theirs }, myPrivateKey, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptMessage(key, text) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return { ciphertext: toB64(ct), iv: toB64(iv) };
}

export async function decryptMessage(key, { ciphertext, iv }) {
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ciphertext));
  return dec.decode(pt);
}
