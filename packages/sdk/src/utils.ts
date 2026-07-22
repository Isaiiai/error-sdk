export function parseBrowser(ua: string): { name: string; version: string } {
  const patterns: Array<[RegExp, string]> = [
    [/edg\/([\d.]+)/i, 'Edge'],
    [/chrome\/([\d.]+)/i, 'Chrome'],
    [/firefox\/([\d.]+)/i, 'Firefox'],
    [/safari\/([\d.]+)/i, 'Safari'],
    [/opr\/([\d.]+)/i, 'Opera'],
  ];
  for (const [re, name] of patterns) {
    const m = ua.match(re);
    if (m) return { name, version: m[1] };
  }
  return { name: 'Unknown', version: '' };
}

export function detectDevice(ua: string): { type: 'mobile' | 'tablet' | 'desktop'; os: string } {
  const isTablet = /ipad|tablet|playbook|silk/i.test(ua);
  const isMobile = /mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua);
  let os = 'Unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac os/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  return {
    type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
    os,
  };
}

export function generateSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function parseStackFrame(stack?: string): { file?: string; line?: number; column?: number } {
  if (!stack) return {};
  const line = stack.split('\n').find((l) => l.includes('.js') || l.includes('.ts'));
  if (!line) return {};
  const match = line.match(/(https?:\/\/[^\s)]+|\/[^\s)]+\.\w+):(\d+):(\d+)/);
  if (!match) return {};
  return { file: match[1], line: parseInt(match[2], 10), column: parseInt(match[3], 10) };
}
