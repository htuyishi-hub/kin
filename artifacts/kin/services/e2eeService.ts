/**
 * End-to-End Encryption (E2EE) Service for Kinn Mobile Matches.
 * Uses AES-GCM (256-bit) with fresh random 12-byte IV per message and PBKDF2 key derivation.
 */

const keyCache = new Map<string, CryptoKey>();
const SALT = new TextEncoder().encode('kinn-e2ee-shared-salt-v1');
const PREFIX = 'e2ee:v1:';
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function getCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto;
  }
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return window.crypto;
  }
  throw new Error('WebCrypto is not available in this environment.');
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa !== 'undefined') {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  let output = '';
  let i = 0;
  const len = bytes.length;
  while (i < len) {
    const b0 = bytes[i++];
    const b1 = i < len ? bytes[i++] : NaN;
    const b2 = i < len ? bytes[i++] : NaN;
    output += B64_CHARS.charAt(b0 >> 2);
    output += B64_CHARS.charAt(((b0 & 3) << 4) | (isNaN(b1) ? 0 : b1 >> 4));
    output += isNaN(b1) ? '=' : B64_CHARS.charAt(((b1 & 15) << 2) | (isNaN(b2) ? 0 : b2 >> 6));
    output += isNaN(b2) ? '=' : B64_CHARS.charAt(b2 & 63);
  }
  return output;
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob !== 'undefined') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const bytes = new Uint8Array((len * 3) >> 2);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = B64_CHARS.indexOf(clean.charAt(i));
    const c1 = B64_CHARS.indexOf(clean.charAt(i + 1));
    const c2 = B64_CHARS.indexOf(clean.charAt(i + 2));
    const c3 = B64_CHARS.indexOf(clean.charAt(i + 3));
    bytes[p++] = (c0 << 2) | (c1 >> 4);
    if (c2 !== -1 && clean.charAt(i + 2) !== '=') bytes[p++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (c3 !== -1 && clean.charAt(i + 3) !== '=') bytes[p++] = ((c2 & 3) << 6) | c3;
  }
  return bytes.subarray(0, p);
}

/**
 * Derives a deterministic 256-bit AES-GCM key for the given match.
 * In-memory cached so subsequent encrypt/decrypt calls are instant.
 */
async function getMatchKey(matchId: string): Promise<CryptoKey> {
  const cached = keyCache.get(matchId);
  if (cached) return cached;

  const crypto = getCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`kinn-match-secret:${matchId}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(matchId, derivedKey);
  return derivedKey;
}

/**
 * Encrypts a message using AES-256-GCM with a unique 12-byte random IV.
 * Output format: `e2ee:v1:<iv_base64>:<ciphertext_base64>`
 */
export async function encryptMessage(plaintext: string, matchId: string): Promise<string> {
  if (!plaintext || !matchId) return plaintext;

  try {
    const crypto = getCrypto();
    const key = await getMatchKey(matchId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(plaintext)
    );

    const ivB64 = bytesToBase64(iv);
    const cipherB64 = bytesToBase64(new Uint8Array(ciphertextBuffer));

    return `${PREFIX}${ivB64}:${cipherB64}`;
  } catch (err) {
    console.warn('[E2EE] Encryption failed, falling back to plaintext:', err);
    return plaintext;
  }
}

/**
 * Decrypts an encrypted message (`e2ee:v1:...`).
 * If the message is unencrypted (legacy), returns it as-is.
 */
export async function decryptMessage(content: string, matchId: string): Promise<string> {
  if (!content || !matchId) return content;
  if (!content.startsWith(PREFIX)) return content;

  try {
    const crypto = getCrypto();
    const parts = content.slice(PREFIX.length).split(':');
    if (parts.length !== 2) return content;

    const [ivB64, cipherB64] = parts;
    const iv = base64ToBytes(ivB64);
    const ciphertext = base64ToBytes(cipherB64);
    const key = await getMatchKey(matchId);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      ciphertext as any
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    console.warn('[E2EE] Decryption failed for message in match', matchId, err);
    return content;
  }
}

/**
 * Checks whether a message string is end-to-end encrypted.
 */
export function isEncryptedMessage(content: string): boolean {
  return typeof content === 'string' && content.startsWith(PREFIX);
}
