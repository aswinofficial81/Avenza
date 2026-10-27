import crypto from 'node:crypto';
import { env } from '../../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits standard for GCM

function getEncryptionKey(): Buffer {
  // Use explicit integration encryption key, fallback to hash of server secret or consistent fallback
  const rawKey =
    env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
    env.CLERK_SECRET_KEY ||
    'avenza-default-secure-integration-encryption-key-seed';

  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts sensitive provider OAuth tokens before persisting to database.
 * Returns IV, AuthTag, and Ciphertext as a single formatted string.
 */
export function encryptToken(token: string | null | undefined): string | null {
  if (!token) return null;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts sensitive provider OAuth tokens securely on backend only.
 * Validates authentication tag to prevent tampering.
 */
export function decryptToken(encryptedPayload: string | null | undefined): string | null {
  if (!encryptedPayload) return null;

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token payload format.');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted token payload format.');
  }
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
