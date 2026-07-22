export interface NetworkActivityEntry {
  timestamp: string;
  type: 'fetch' | 'xhr';
  method: string;
  url: string;
  status?: number;
  ok?: boolean;
  durationMs: number;
  requestBody?: string;
  responseBody?: string;
  error?: string;
}

export interface NetworkRecorderOptions {
  maxEntries?: number;
  maxRequestBodyLength?: number;
  maxResponseBodyLength?: number;
  /** URLs to skip (e.g. SDK ingest endpoint) */
  ignoreUrls?: string[];
  onEntry?: (entry: NetworkActivityEntry) => void;
}

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-secret-key',
  'x-project-key',
]);

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

async function readBody(
  body: BodyInit | null | undefined,
  maxLength: number
): Promise<string | undefined> {
  if (body == null) return undefined;
  try {
    if (typeof body === 'string') return truncate(body, maxLength);
    if (body instanceof URLSearchParams) return truncate(body.toString(), maxLength);
    if (body instanceof FormData) {
      const parts: string[] = [];
      body.forEach((value, key) => {
        parts.push(`${key}=${typeof value === 'string' ? value : '[binary]'}`);
      });
      return truncate(parts.join('&'), maxLength);
    }
    if (body instanceof Blob) {
      const text = await body.text();
      return truncate(text, maxLength);
    }
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
      return '[binary]';
    }
    return truncate(String(body), maxLength);
  } catch {
    return '[unreadable]';
  }
}

function shouldIgnoreUrl(url: string, ignoreUrls: string[]): boolean {
  return ignoreUrls.some((pattern) => url.includes(pattern));
}

export class NetworkActivityRecorder {
  private entries: NetworkActivityEntry[] = [];
  private readonly maxEntries: number;
  private readonly maxRequestBodyLength: number;
  private readonly maxResponseBodyLength: number;
  private readonly ignoreUrls: string[];
  private readonly onEntry?: (entry: NetworkActivityEntry) => void;
  private installed = false;
  private restoreFetch?: () => void;
  private restoreXhr?: () => void;

  constructor(options: NetworkRecorderOptions = {}) {
    this.maxEntries = options.maxEntries ?? 50;
    this.maxRequestBodyLength = options.maxRequestBodyLength ?? 1000;
    this.maxResponseBodyLength = options.maxResponseBodyLength ?? 1000;
    this.ignoreUrls = options.ignoreUrls ?? [];
    this.onEntry = options.onEntry;
  }

  getEntries(): NetworkActivityEntry[] {
    return [...this.entries];
  }

  clear() {
    this.entries = [];
  }

  private record(entry: NetworkActivityEntry) {
    if (shouldIgnoreUrl(entry.url, this.ignoreUrls)) return;
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    this.onEntry?.(entry);
  }

  install() {
    if (typeof window === 'undefined' || this.installed) return;
    this.installed = true;
    this.patchFetch();
    this.patchXhr();
  }

  uninstall() {
    this.restoreFetch?.();
    this.restoreXhr?.();
    this.restoreFetch = undefined;
    this.restoreXhr = undefined;
    this.installed = false;
  }

  private patchFetch() {
    const originalFetch = window.fetch.bind(window);
    const recorder = this;

    window.fetch = async function patchedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const startedAt = Date.now();
      const request = input instanceof Request ? input : undefined;
      const url = request?.url || String(input);
      const method = (init?.method || request?.method || 'GET').toUpperCase();

      if (shouldIgnoreUrl(url, recorder.ignoreUrls)) {
        return originalFetch(input, init);
      }

      let requestBody: string | undefined;
      if (init?.body != null) {
        requestBody = await readBody(init.body, recorder.maxRequestBodyLength);
      } else if (request?.body) {
        try {
          const clone = request.clone();
          requestBody = truncate(await clone.text(), recorder.maxRequestBodyLength);
        } catch {
          requestBody = '[unreadable]';
        }
      }

      try {
        const response = await originalFetch(input, init);
        let responseBody: string | undefined;
        try {
          const clone = response.clone();
          const text = await clone.text();
          responseBody = truncate(text, recorder.maxResponseBodyLength);
        } catch {
          responseBody = '[unreadable]';
        }

        recorder.record({
          timestamp: new Date().toISOString(),
          type: 'fetch',
          method,
          url,
          status: response.status,
          ok: response.ok,
          durationMs: Date.now() - startedAt,
          requestBody,
          responseBody,
        });

        return response;
      } catch (err) {
        recorder.record({
          timestamp: new Date().toISOString(),
          type: 'fetch',
          method,
          url,
          durationMs: Date.now() - startedAt,
          requestBody,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    };

    this.restoreFetch = () => {
      window.fetch = originalFetch;
    };
  }

  private patchXhr() {
    const recorder = this;
    const XHR = XMLHttpRequest.prototype;
    const originalOpen = XHR.open;
    const originalSend = XHR.send;

    type XhrState = {
      method: string;
      url: string;
      startedAt: number;
      requestBody?: string;
    };

    const stateMap = new WeakMap<XMLHttpRequest, XhrState>();

    XHR.open = function patchedOpen(
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      stateMap.set(this, {
        method: method.toUpperCase(),
        url: String(url),
        startedAt: Date.now(),
      });
      return originalOpen.call(this, method, url, async ?? true, username, password);
    };

    XHR.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null) {
      const state = stateMap.get(this);
      if (state) {
        void readBody(body as BodyInit | null | undefined, recorder.maxRequestBodyLength).then(
          (requestBody) => {
            state.requestBody = requestBody;
          }
        );
      }

      this.addEventListener('loadend', function onLoadEnd() {
        const xhrState = stateMap.get(this);
        if (!xhrState) return;

        if (shouldIgnoreUrl(xhrState.url, recorder.ignoreUrls)) return;

        let responseBody: string | undefined;
        try {
          const text = this.responseType === '' || this.responseType === 'text'
            ? String(this.responseText || '')
            : `[${this.responseType || 'unknown'}]`;
          responseBody = truncate(text, recorder.maxResponseBodyLength);
        } catch {
          responseBody = '[unreadable]';
        }

        recorder.record({
          timestamp: new Date().toISOString(),
          type: 'xhr',
          method: xhrState.method,
          url: xhrState.url,
          status: this.status || undefined,
          ok: this.status >= 200 && this.status < 300,
          durationMs: Date.now() - xhrState.startedAt,
          requestBody: xhrState.requestBody,
          responseBody,
          error: this.status === 0 ? 'Network request failed' : undefined,
        });
      });

      return originalSend.call(this, body);
    };

    this.restoreXhr = () => {
      XHR.open = originalOpen;
      XHR.send = originalSend;
    };
  }
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[redacted]' : value;
  }
  return out;
}
