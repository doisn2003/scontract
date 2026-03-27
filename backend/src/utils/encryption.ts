import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size

/**
 * Get the encryption key from environment variables.
 * Must be exactly 32 bytes for AES-256.
 */
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY is not set in environment variables');
  }
  // Ensure key is 32 bytes by hashing it
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a plaintext string using AES-256-CBC.
 * Returns a string in format: iv:encrypted (both hex-encoded)
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string that was encrypted with the encrypt function.
 * Expects input in format: iv:encrypted (both hex-encoded)
 */
export function decrypt(encryptedText: string): string {
  const key = getKey();
  const [ivHex, encrypted] = encryptedText.split(':');
  if (!ivHex || !encrypted) {
    throw new Error('Invalid encrypted text format. Expected "iv:encrypted"');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
