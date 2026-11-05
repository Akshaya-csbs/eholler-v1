import crypto from 'crypto';

/**
 * Token Encryption Utility using AES-256-GCM.
 * Ensures Google OAuth access tokens and refresh tokens are never stored
 * in plaintext in the database.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Resolves and validates a 32-byte encryption key from the environment.
 * Throws a clear error if TOKEN_ENCRYPTION_KEY is missing or invalid,
 * preventing insecure plaintext storage or silent unvalidated keys.
 */
export function getEncryptionKey(): Buffer {
  const envKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!envKey || envKey.trim().length === 0) {
    throw new Error(
      'Missing required environment variable TOKEN_ENCRYPTION_KEY. Google OAuth tokens cannot be safely encrypted or decrypted without a valid 32-byte encryption key.'
    );
  }

  const trimmed = envKey.trim();
  if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
    // 32-byte hex string
    return Buffer.from(trimmed, 'hex');
  }

  if (trimmed.length === 44 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    // 32-byte base64 string
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length === 32) return buf;
  }

  // If a passphrase of sufficient length is provided, derive a 32-byte key via SHA-256
  if (trimmed.length >= 16) {
    return crypto.createHash('sha256').update(trimmed).digest();
  }

  throw new Error(
    'TOKEN_ENCRYPTION_KEY must be at least 16 characters (or a 64-character hex / 44-character base64 string) to provide 256 bits of security.'
  );
}

/**
 * Encrypts a plaintext OAuth token into an encrypted payload (format: iv:authTag:ciphertext).
 */
export function encryptToken(plainText: string): string {
  if (!plainText) return '';

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedContent
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted OAuth token back into plaintext.
 */
export function decryptToken(encryptedPayload: string): string {
  if (!encryptedPayload) return '';

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token payload format. Expected iv:authTag:ciphertext.');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

