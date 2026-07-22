/** Build a concise debug prompt from an error event for LLM tools. */

export interface ErrorForLlm {
  errorType?: string;
  message?: string;
  severity?: string;
  environment?: string;
  version?: string;
  url?: string;
  stackTrace?: string;
  fingerprint?: string;
  occurrenceCount?: number;
  browser?: { name?: string; version?: string; userAgent?: string };
  device?: { type?: string; os?: string; osVersion?: string };
  sourceMap?: { file?: string; line?: number; column?: number; context?: string };
  breadcrumbs?: Array<{ category?: string; message?: string; level?: string }>;
  networkActivity?: Array<{
    method?: string;
    url?: string;
    status?: number;
    durationMs?: number;
    error?: string;
  }>;
  platform?: Record<string, unknown>;
  context?: { customData?: Record<string, unknown>; tags?: string[] };
}

function clip(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated]`;
}

export function buildErrorLlmPrompt(error: ErrorForLlm): string {
  const network =
    error.networkActivity ||
    (error.context?.customData?.networkActivity as ErrorForLlm['networkActivity']) ||
    [];

  const lines: string[] = [
    'You are a senior software engineer. Analyze this production/runtime error and help me fix it.',
    '',
    '## Error',
    `- Type: ${error.errorType || 'Unknown'}`,
    `- Message: ${error.message || '—'}`,
    `- Severity: ${error.severity || '—'}`,
    `- Environment: ${error.environment || '—'}`,
    `- Version: ${error.version || '—'}`,
    `- URL: ${error.url || '—'}`,
    `- Occurrences: ${error.occurrenceCount ?? '—'}`,
    `- Fingerprint: ${error.fingerprint || '—'}`,
  ];

  if (error.browser || error.device) {
    lines.push('', '## Client');
    if (error.browser) {
      lines.push(
        `- Browser: ${[error.browser.name, error.browser.version].filter(Boolean).join(' ') || '—'}`
      );
    }
    if (error.device) {
      lines.push(
        `- Device: ${[error.device.type, error.device.os, error.device.osVersion].filter(Boolean).join(' / ') || '—'}`
      );
    }
  }

  if (error.sourceMap?.file) {
    lines.push(
      '',
      '## Source location',
      `- File: ${error.sourceMap.file}:${error.sourceMap.line ?? '?'}:${error.sourceMap.column ?? '?'}`,
      error.sourceMap.context ? `- Context:\n${clip(String(error.sourceMap.context), 800)}` : ''
    );
  }

  if (error.stackTrace) {
    lines.push('', '## Stack trace', '```', clip(error.stackTrace, 4000), '```');
  }

  if (error.breadcrumbs?.length) {
    lines.push('', '## Recent breadcrumbs');
    error.breadcrumbs.slice(-12).forEach((b) => {
      lines.push(`- [${b.category || 'log'}/${b.level || 'info'}] ${b.message || ''}`);
    });
  }

  if (network?.length) {
    lines.push('', '## Network activity before error');
    network.slice(-10).forEach((n) => {
      lines.push(
        `- ${n.method || 'GET'} ${n.url || ''} → ${n.status ?? 'err'} (${n.durationMs ?? '?'}ms)${n.error ? ` · ${n.error}` : ''}`
      );
    });
  }

  if (error.platform && Object.keys(error.platform).length) {
    lines.push(
      '',
      '## Platform',
      '```json',
      clip(JSON.stringify(error.platform, null, 2), 1200),
      '```'
    );
  }

  lines.push(
    '',
    '## What I need',
    '1. Likely root cause',
    '2. Exact files/functions to inspect',
    '3. Concrete fix (code snippet if possible)',
    '4. How to verify and prevent regression',
    ''
  );

  return lines.filter((l) => l !== undefined).join('\n');
}

export type LlmProvider = 'chatgpt' | 'claude' | 'copy';

/** Shorter prompt for URL query params (browser length limits). */
export function buildErrorLlmPromptCompact(error: ErrorForLlm): string {
  const full = buildErrorLlmPrompt(error);
  return clip(full, 5500);
}

export function openErrorWithLlm(error: ErrorForLlm, provider: LlmProvider): 'opened' | 'copied' {
  if (provider === 'copy') {
    void navigator.clipboard.writeText(buildErrorLlmPrompt(error));
    return 'copied';
  }

  const prompt = buildErrorLlmPromptCompact(error);
  const q = encodeURIComponent(prompt);

  const urls: Record<Exclude<LlmProvider, 'copy'>, string> = {
    chatgpt: `https://chatgpt.com/?q=${q}`,
    claude: `https://claude.ai/new?q=${q}`,
  };

  window.open(urls[provider], '_blank', 'noopener,noreferrer');
  return 'opened';
}
