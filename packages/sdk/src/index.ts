import type {
  Breadcrumb,
  CaptureContext,
  ErrorEvent,
  ErrorTrackerConfig,
  Severity,
  UserContext,
} from './types';
import { captureScreenshot } from './screenshot';
import { analyzePlatform, type PlatformAnalysis } from './platform';
import { detectDevice, generateSessionId, parseBrowser, parseStackFrame } from './utils';
import { NetworkActivityRecorder } from './network';
import { PageTracker, type PageViewPayload, resolveDevicePlatform } from './pageTracker';

export type {
  Breadcrumb,
  CaptureContext,
  ErrorEvent,
  ErrorTrackerConfig,
  Severity,
  UserContext,
  ScreenshotAttachment,
  Environment,
  NetworkActivityEntry,
} from './types';
export { captureScreenshot } from './screenshot';
export { analyzePlatform } from './platform';
export type { PlatformAnalysis, RuntimePlatform } from './platform';

export interface SupportAttachmentInput {
  filename: string;
  dataUrl: string;
  contentType?: string;
}

export interface SupportRequestInput {
  title: string;
  description: string;
  category?: 'feature_request' | 'bug' | 'performance' | 'security' | 'question' | 'other';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  reporterName?: string;
  reporterEmail?: string;
  tags?: string[];
  attachments?: SupportAttachmentInput[];
}

export interface SupportTicketSummary {
  _id: string;
  ticketNumber: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  category?: string;
  reporterName?: string;
  reporterEmail?: string;
  createdAt: string;
  updatedAt?: string;
  attachments?: Array<{
    filename: string;
    url?: string;
    contentType?: string;
    size?: number;
  }>;
}

export interface MaintenanceWindowInfo {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  severity: string;
  status: string;
  affectedComponents?: string[];
}

export interface MaintenanceStatus {
  active: boolean;
  projectName?: string;
  windows: MaintenanceWindowInfo[];
}

const DEFAULT_CONFIG: Partial<ErrorTrackerConfig> = {
  environment: 'production',
  version: '1.0.0',
  sampleRate: 1.0,
  maxBreadcrumbs: 50,
  debug: false,
  captureUnhandledRejections: true,
  captureConsoleErrors: false,
  captureScreenshot: true,
  screenshotQuality: 0.55,
  screenshotMaxWidth: 1280,
  screenshotMaxHeight: 720,
  flushIntervalMs: 5000,
  maxQueueSize: 30,
  captureNetworkActivity: true,
  maxNetworkEntries: 50,
  maxRequestBodyLength: 1000,
  maxResponseBodyLength: 1000,
  trackPageViews: true,
  checkMaintenance: true,
  maintenancePollIntervalMs: 5_000,
};

export class ErrorTracker {
  private config: ErrorTrackerConfig;
  private breadcrumbs: Breadcrumb[] = [];
  private user?: UserContext;
  private tags: Record<string, string> = {};
  private customContexts: Record<string, Record<string, unknown>> = {};
  private queue: ErrorEvent[] = [];
  private sessionId: string;
  private flushTimer?: ReturnType<typeof setInterval>;
  private closed = false;
  private handlersInstalled = false;
  private networkRecorder?: NetworkActivityRecorder;
  private pageTracker?: PageTracker;
  private maintenanceTimer?: ReturnType<typeof setInterval>;
  private maintenanceState: MaintenanceStatus = { active: false, windows: [] };
  private maintenanceListeners = new Set<(status: MaintenanceStatus) => void>();

  constructor(config: ErrorTrackerConfig) {
    if (!config.projectKey || !config.secretKey || !config.dsn) {
      throw new Error('ErrorTracker requires projectKey, secretKey, and dsn');
    }
    this.config = { ...DEFAULT_CONFIG, ...config } as ErrorTrackerConfig;
    this.sessionId = generateSessionId();
    this.installGlobalHandlers();
    this.installNetworkInstrumentation();
    this.installPageTracking();
    this.installMaintenancePolling();
    this.flushTimer = setInterval(() => void this.flush(), this.config.flushIntervalMs);
  }

  static HTTPIntegration() {
    return { name: 'HTTPIntegration', enabled: true };
  }

  static ReactIntegration() {
    return { name: 'ReactIntegration' };
  }

  private log(...args: unknown[]) {
    if (this.config.debug) console.debug('[ErrorTracker]', ...args);
  }

  private installNetworkInstrumentation() {
    if (this.config.captureNetworkActivity === false) return;
    if (typeof window === 'undefined') return;

    const ignoreUrls = [
      this.config.dsn,
      this.config.dsn.replace(/\/errors\/?$/, '/support'),
      this.config.dsn.replace(/\/errors\/?$/, '/analytics'),
    ].filter(Boolean);

    this.networkRecorder = new NetworkActivityRecorder({
      maxEntries: this.config.maxNetworkEntries,
      maxRequestBodyLength: this.config.maxRequestBodyLength,
      maxResponseBodyLength: this.config.maxResponseBodyLength,
      ignoreUrls,
      onEntry: (entry) => {
        this.addBreadcrumb({
          category: 'http',
          message: `${entry.method} ${entry.url} → ${entry.status ?? 'failed'} (${entry.durationMs}ms)`,
          level: entry.ok === false || entry.error ? 'warning' : 'info',
          data: {
            type: entry.type,
            status: entry.status,
            durationMs: entry.durationMs,
            requestBody: entry.requestBody,
            responseBody: entry.responseBody,
            error: entry.error,
          },
        });
      },
    });
    this.networkRecorder.install();
  }

  private apiBaseFromDsn() {
    return this.config.dsn.replace(/\/errors\/?$/, '');
  }

  private authHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Project-Key': this.config.projectKey,
      'X-Secret-Key': this.config.secretKey,
    };
  }

  private installPageTracking() {
    if (this.config.trackPageViews === false) return;
    if (typeof window === 'undefined') return;

    this.pageTracker = new PageTracker(
      async (payload) => {
        try {
          await this.sendPageView(payload);
        } catch (err) {
          this.log('Page view failed', err);
        }
      },
      () => ({
        sessionId: this.sessionId,
        userId: this.user?.id,
        platform: this.analyzeFrontend(),
      })
    );
    this.pageTracker.install();
  }

  private installMaintenancePolling() {
    if (this.config.checkMaintenance === false) return;
    if (typeof window === 'undefined') return;

    void this.refreshMaintenance();
    const interval = this.config.maintenancePollIntervalMs ?? 5_000;
    this.maintenanceTimer = setInterval(() => void this.refreshMaintenance(), interval);

    const onFocus = () => void this.refreshMaintenance();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus();
    });
  }

  async sendPageView(payload: PageViewPayload) {
    const url = `${this.apiBaseFromDsn()}/analytics/pageviews`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Page view failed (${res.status})`);
    }
    this.addBreadcrumb({
      category: 'navigation',
      message: `Viewed ${payload.path}`,
      level: 'info',
      data: { platform: payload.platform, durationMs: payload.durationMs },
    });
  }

  /** Manually record a page view (SPA route change, etc.) */
  async trackPageView(path?: string, title?: string) {
    const p = path || (typeof location !== 'undefined' ? location.pathname + location.search : '/');
    if (this.pageTracker) {
      await this.pageTracker.trackPath(p, title);
      return;
    }
    const platformAnalysis = this.analyzeFrontend();
    await this.sendPageView({
      sessionId: this.sessionId,
      userId: this.user?.id,
      path: p,
      title,
      url: typeof location !== 'undefined' ? location.href : undefined,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      platform: resolveDevicePlatform(platformAnalysis),
      runtime: platformAnalysis.runtime,
      browser: platformAnalysis.browser.name,
      os: platformAnalysis.device.os,
      engaged: true,
    });
  }

  getMaintenanceStatus(): MaintenanceStatus {
    return this.maintenanceState;
  }

  onMaintenanceChange(listener: (status: MaintenanceStatus) => void): () => void {
    this.maintenanceListeners.add(listener);
    listener(this.maintenanceState);
    return () => this.maintenanceListeners.delete(listener);
  }

  async refreshMaintenance(): Promise<MaintenanceStatus> {
    try {
      const res = await fetch(`${this.apiBaseFromDsn()}/analytics/maintenance/active`, {
        headers: this.authHeaders(),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error?.message || `Maintenance check failed (${res.status})`);
      }
      const data = body.data || body;
      this.maintenanceState = {
        active: !!data.active,
        projectName: data.projectName,
        windows: data.windows || [],
      };
      this.maintenanceListeners.forEach((l) => l(this.maintenanceState));
      return this.maintenanceState;
    } catch (err) {
      this.log('Maintenance poll failed', err);
      return this.maintenanceState;
    }
  }

  private installGlobalHandlers() {
    if (typeof window === 'undefined' || this.handlersInstalled) return;
    this.handlersInstalled = true;

    window.addEventListener('error', (event) => {
      if (this.closed) return;
      const error = event.error || new Error(event.message);
      this.captureException(error, { level: 'high' });
    });

    if (this.config.captureUnhandledRejections) {
      window.addEventListener('unhandledrejection', (event) => {
        if (this.closed) return;
        const reason = event.reason;
        const error = reason instanceof Error ? reason : new Error(String(reason));
        this.captureException(error, { level: 'high' });
      });
    }

    if (this.config.captureConsoleErrors) {
      const originalError = console.error;
      console.error = (...args: unknown[]) => {
        this.addBreadcrumb({
          category: 'console',
          message: args.map(String).join(' '),
          level: 'error',
        });
        originalError.apply(console, args);
      };
    }
  }

  /**
   * Capture an exception. Returns an event id immediately; screenshot capture
   * and enqueue happen asynchronously when enabled.
   */
  captureException(error: unknown, context?: CaptureContext): string | undefined {
    if (this.closed) return;
    if (Math.random() > (this.config.sampleRate ?? 1)) {
      this.log('Dropped by sample rate');
      return;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    const id = `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    void this.processException(err, context, id);
    return id;
  }

  captureMessage(message: string, level: Severity = 'info', context?: CaptureContext): string | undefined {
    if (this.closed) return;
    const error = new Error(message);
    error.name = 'CaptureMessage';
    return this.captureException(error, { ...context, level });
  }

  private async processException(
    error: Error,
    context: CaptureContext | undefined,
    id: string
  ): Promise<void> {
    const shouldCapture =
      context?.captureScreenshot ?? this.config.captureScreenshot ?? true;

    let screenshot = undefined;
    if (shouldCapture) {
      try {
        screenshot = await captureScreenshot({
          quality: this.config.screenshotQuality,
          maxWidth: this.config.screenshotMaxWidth,
          maxHeight: this.config.screenshotMaxHeight,
        });
        if (screenshot) {
          this.log('Screenshot captured', screenshot.width, 'x', screenshot.height);
        } else {
          this.log('Screenshot capture returned empty');
        }
      } catch (err) {
        this.log('Screenshot capture failed', err);
      }
    }

    const event = this.buildEvent(error, context);
    event.id = id;
    if (screenshot) {
      event.screenshot = screenshot;
    }
    try {
      event.platform = this.analyzeFrontend() as unknown as Record<string, unknown>;
    } catch (err) {
      this.log('Platform analysis failed', err);
    }
    this.enqueue(event);
  }

  /** Analyze current frontend runtime, frameworks, device, and webview context */
  analyzeFrontend(): PlatformAnalysis {
    return analyzePlatform();
  }

  private supportBaseUrl() {
    return this.config.dsn.replace(/\/errors\/?$/, '/support/tickets');
  }

  private supportHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Project-Key': this.config.projectKey,
      'X-Secret-Key': this.config.secretKey,
    };
  }

  /**
   * Submit a customer support / feature request ticket.
   * Uses the same project API keys; posts to /api/v1/support/tickets
   */
  async submitSupportRequest(input: SupportRequestInput): Promise<{
    ticketId?: string;
    ticketNumber?: string;
    status?: string;
    attachmentCount?: number;
    message?: string;
  }> {
    const platform = this.analyzeFrontend();

    const res = await fetch(this.supportBaseUrl(), {
      method: 'POST',
      headers: this.supportHeaders(),
      body: JSON.stringify({
        ...input,
        pageUrl: typeof location !== 'undefined' ? location.href : undefined,
        platform,
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error?.message || `Support request failed (${res.status})`);
    }
    return body.data || body;
  }

  async listSupportTickets(filters?: {
    email?: string;
    status?: string;
  }): Promise<SupportTicketSummary[]> {
    const params = new URLSearchParams();
    if (filters?.email) params.set('email', filters.email);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    const res = await fetch(`${this.supportBaseUrl()}${qs ? `?${qs}` : ''}`, {
      headers: this.supportHeaders(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error?.message || `Failed to list tickets (${res.status})`);
    }
    return body.data?.tickets || [];
  }

  async getSupportTicket(
    ticketId: string,
    email?: string
  ): Promise<SupportTicketSummary & { comments?: unknown[]; customFields?: unknown }> {
    const params = new URLSearchParams();
    if (email) params.set('email', email);
    const qs = params.toString();
    const res = await fetch(`${this.supportBaseUrl()}/${ticketId}${qs ? `?${qs}` : ''}`, {
      headers: this.supportHeaders(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error?.message || `Failed to load ticket (${res.status})`);
    }
    return body.data || body;
  }

  async addSupportComment(
    ticketId: string,
    input: { content: string; authorName?: string; email?: string }
  ) {
    const res = await fetch(`${this.supportBaseUrl()}/${ticketId}/comments`, {
      method: 'POST',
      headers: this.supportHeaders(),
      body: JSON.stringify(input),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error?.message || `Failed to add comment (${res.status})`);
    }
    return body.data || body;
  }

  setUser(user: UserContext | null) {
    this.user = user || undefined;
  }

  setContext(name: string, data: Record<string, unknown>) {
    this.customContexts[name] = data;
  }

  setTag(key: string, value: string) {
    this.tags[key] = value;
  }

  clearContext() {
    this.customContexts = {};
    this.tags = {};
    this.user = undefined;
  }

  addBreadcrumb(breadcrumb: Breadcrumb) {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: breadcrumb.timestamp || new Date().toISOString(),
      level: breadcrumb.level || 'info',
    });
    const max = this.config.maxBreadcrumbs ?? 50;
    if (this.breadcrumbs.length > max) {
      this.breadcrumbs = this.breadcrumbs.slice(-max);
    }
  }

  private buildEvent(error: Error, context?: CaptureContext): ErrorEvent {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const browser = parseBrowser(ua);
    const device = detectDevice(ua);
    const sourceMap = parseStackFrame(error.stack);

    const networkActivity = this.networkRecorder?.getEntries() ?? [];

    const customData: Record<string, unknown> = {
      ...Object.assign({}, ...Object.values(this.customContexts)),
      ...(context?.context || {}),
    };

    const tags = [
      ...Object.entries(this.tags).map(([k, v]) => `${k}:${v}`),
      ...Object.entries(context?.tags || {}).map(([k, v]) => `${k}:${v}`),
    ];

    return {
      timestamp: new Date().toISOString(),
      message: error.message || String(error),
      errorType: error.name || 'Error',
      severity: context?.level || 'medium',
      stackTrace: error.stack || '',
      sourceMap,
      environment: this.config.environment || 'production',
      version: this.config.version || '1.0.0',
      browser: { ...browser, userAgent: ua },
      device,
      url: typeof location !== 'undefined' ? location.href : '',
      user: this.user
        ? {
            id: this.user.id,
            email: this.user.email,
            username: this.user.username,
            customData: Object.fromEntries(
              Object.entries(this.user).filter(([k]) => !['id', 'email', 'username'].includes(k))
            ),
          }
        : undefined,
      sessionId: this.sessionId,
      breadcrumbs: [...this.breadcrumbs],
      networkActivity,
      context: {
        customData: {
          ...customData,
          networkActivity,
        },
        tags,
        release: this.config.release,
      },
      fingerprint: context?.fingerprint,
    };
  }

  private enqueue(event: ErrorEvent): string {
    let payload = event;
    if (this.config.beforeSend) {
      const filtered = this.config.beforeSend(event);
      if (!filtered) {
        this.log('Event filtered by beforeSend');
        return '';
      }
      payload = filtered;
    }

    const id = payload.id || `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    payload.id = id;
    this.queue.push(payload);

    const max = this.config.maxQueueSize ?? 30;
    if (this.queue.length >= max) {
      void this.flush();
    }

    this.log('Queued event', id, payload.message, payload.screenshot ? '(with screenshot)' : '');
    return id;
  }

  async flush(timeoutMs = 5000): Promise<void> {
    if (!this.queue.length) return;

    const batch = this.queue.splice(0, this.queue.length);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

    try {
      await Promise.all(
        batch.map(async (event) => {
          const res = await fetch(this.config.dsn, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Project-Key': this.config.projectKey,
              'X-Secret-Key': this.config.secretKey,
            },
            body: JSON.stringify(event),
            signal: controller?.signal,
            keepalive: true,
          });
          if (!res.ok) {
            this.log('Failed to send event', res.status);
            this.queue.unshift(event);
          } else {
            this.log('Sent event', event.id);
          }
        })
      );
    } catch (err) {
      this.log('Flush error', err);
      this.queue.unshift(...batch);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  close() {
    this.closed = true;
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.maintenanceTimer) clearInterval(this.maintenanceTimer);
    this.networkRecorder?.uninstall();
    this.pageTracker?.uninstall();
    void this.flush();
  }
}

export default ErrorTracker;
