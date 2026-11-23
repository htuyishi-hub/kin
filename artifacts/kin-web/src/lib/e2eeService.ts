/**
 * End-to-End Encryption (E2EE) Service for Kinn Web Matches.
 * Uses AES-GCM (256-bit) with fresh random 12-byte IV per message and PBKDF2 key derivation.
 */

const keyCache = new Map<string, CryptoKey>();
const SALT = new TextEncoder().encode('kinn-e2ee-shared-salt-v1');
const PREFIX = 'e2ee:v1:';

function getCrypto(): Crypto {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto;
  }
  throw new Error('WebCrypto is not available in this environment.');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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
