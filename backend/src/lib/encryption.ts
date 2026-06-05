import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export function encrypt(text: string, keyHex: string): { ciphertext: string; iv: string } {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([tag, encrypted]);
  return {
    ciphertext: combined.toString('base64'),
    iv: iv.toString('hex'),
  };
}

export function decrypt(ciphertext: string, iv: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const ivBuffer = Buffer.from(iv, 'hex');
  const combined = Buffer.from(ciphertext, 'base64');
  const tag = combined.subarray(0, TAG_LENGTH);
  const encrypted = combined.subarray(TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
