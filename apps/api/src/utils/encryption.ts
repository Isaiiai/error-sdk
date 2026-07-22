import crypto from 'crypto';
import { config } from '../config';

const ALGO = 'aes-256-gcm';

function keyBytes(): Buffer {
  return crypto.createHash('sha256').update(config.credentialsEncryptionKey).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  if (!payload) return '';
  if (!payload.startsWith('enc:')) return payload;
  const [, ivB64, tagB64, dataB64] = payload.split(':');
  const decipher = crypto.createDecipheriv(ALGO, keyBytes(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

export function maskSecret(value?: string): string {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(8, value.length - 2))}${value.slice(-2)}`;
}
