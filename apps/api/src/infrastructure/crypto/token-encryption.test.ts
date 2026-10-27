import { describe, expect, it } from 'vitest';
import { encryptToken, decryptToken } from './token-encryption';

describe('Token Encryption & Decryption (AES-256-GCM)', () => {
  it('encrypts and decrypts OAuth access token cleanly', () => {
    const originalToken = 'gho_16C7e42F292c6912E7710c838347Ae178B4a';
    const encrypted = encryptToken(originalToken);

    expect(encrypted).not.toBeNull();
    expect(encrypted).not.toEqual(originalToken);
    expect(encrypted).toContain(':');

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toEqual(originalToken);
  });

  it('handles null and undefined safely', () => {
    expect(encryptToken(null)).toBeNull();
    expect(encryptToken(undefined)).toBeNull();
    expect(decryptToken(null)).toBeNull();
    expect(decryptToken(undefined)).toBeNull();
  });

  it('fails with tampering error if ciphertext is modified', () => {
    const originalToken = 'secret-token-12345';
    const encrypted = encryptToken(originalToken)!;
    const parts = encrypted.split(':');
    // Tamper with the ciphertext
    const tampered = `${parts[0]}:${parts[1]}:ff${parts[2]!.substring(2)}`;

    expect(() => decryptToken(tampered)).toThrow();
  });

  it('fails if format is corrupted', () => {
    expect(() => decryptToken('invalid-format')).toThrow('Invalid encrypted token payload format.');
  });
});
