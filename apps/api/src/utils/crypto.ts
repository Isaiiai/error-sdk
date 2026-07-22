import crypto from 'crypto';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateApiKey(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(24).toString('hex')}`;
}

export function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function computeFingerprint(message: string, errorType: string, stackTrace?: string): string {
  const firstFrame = stackTrace?.split('\n').find((l) => l.trim().startsWith('at ')) || '';
  const normalized = `${errorType}|${message.replace(/\d+/g, 'N')}|${firstFrame.replace(/:\d+:\d+/g, ':L:C')}`;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

export function nextTicketNumber(count: number): string {
  return `TKT-${String(count + 1).padStart(5, '0')}`;
}
