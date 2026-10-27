import crypto from 'node:crypto';

export interface SvixHeaders {
  'svix-id'?: string;
  'svix-timestamp'?: string;
  'svix-signature'?: string;
  [key: string]: string | undefined;
}

export interface VerifyWebhookOptions {
  rawBody: string;
  headers: SvixHeaders;
  signingSecret: string;
  maxTimestampToleranceSeconds?: number;
}

/**
 * Verifies standard Svix / Clerk webhook signatures using HMAC-SHA256
 * and constant-time comparison to prevent timing attacks.
 */
export function verifyClerkWebhookSignature(options: VerifyWebhookOptions): { isValid: boolean; error?: string } {
  const { rawBody, headers, signingSecret, maxTimestampToleranceSeconds = 300 } = options;

  if (!signingSecret || !signingSecret.trim()) {
    return { isValid: false, error: 'Signing secret is missing or empty' };
  }

  const svixId = headers['svix-id'];
  const svixTimestamp = headers['svix-timestamp'];
  const svixSignature = headers['svix-signature'];

  if (!svixId || typeof svixId !== 'string') {
    return { isValid: false, error: 'Missing svix-id header' };
  }

  if (!svixTimestamp || typeof svixTimestamp !== 'string') {
    return { isValid: false, error: 'Missing svix-timestamp header' };
  }

  if (!svixSignature || typeof svixSignature !== 'string') {
    return { isValid: false, error: 'Missing svix-signature header' };
  }

  // 1. Validate timestamp to guard against replay attacks
  const timestampNum = parseInt(svixTimestamp, 10);
  if (isNaN(timestampNum)) {
    return { isValid: false, error: 'Malformed svix-timestamp' };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampNum) > maxTimestampToleranceSeconds) {
    return { isValid: false, error: 'Webhook timestamp expired or out of tolerance window' };
  }

  // 2. Decode secret (strip whsec_ prefix if present, then decode base64)
  const cleanSecret = signingSecret.startsWith('whsec_') ? signingSecret.slice(6) : signingSecret;
  let secretKey: Buffer;
  try {
    secretKey = Buffer.from(cleanSecret, 'base64');
    if (secretKey.length === 0) {
      return { isValid: false, error: 'Invalid base64 signing secret' };
    }
  } catch {
    return { isValid: false, error: 'Failed to decode signing secret' };
  }

  // 3. Compute expected HMAC
  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
  const computedHash = crypto.createHmac('sha256', secretKey).update(toSign).digest('base64');
  const computedBuffer = Buffer.from(computedHash);

  // 4. Check all signatures provided in header (space separated)
  const passedSignatures = svixSignature.split(' ');
  for (const versionedSig of passedSignatures) {
    const parts = versionedSig.split(',');
    if (parts.length === 2 && parts[0] === 'v1') {
      const candidateBuffer = Buffer.from(parts[1] || '');
      if (candidateBuffer.length === computedBuffer.length && crypto.timingSafeEqual(candidateBuffer, computedBuffer)) {
        return { isValid: true };
      }
    }
  }

  return { isValid: false, error: 'Invalid webhook signature' };
}
