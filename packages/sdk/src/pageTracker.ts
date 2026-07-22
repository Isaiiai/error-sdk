/**
 * Page engagement + SPA route tracking for ErrorTracker.
 */
import type { PlatformAnalysis } from './platform';

export type DevicePlatform = 'mobile' | 'tablet' | 'desktop' | 'webview' | 'unknown';

export interface PageViewPayload {
  sessionId: string;
  userId?: string;
  path: string;
  title?: string;
  referrer?: string;
  url?: string;
  platform: DevicePlatform;
  runtime?: string;
  browser?: string;
  os?: string;
  durationMs?: number;
  engaged?: boolean;
  metadata?: Record<string, unknown>;
}

export function resolveDevicePlatform(platform: PlatformAnalysis): DevicePlatform {
  if (platform.isWebView) return 'webview';
  if (platform.device.type === 'mobile') return 'mobile';
  if (platform.device.type === 'tablet') return 'tablet';
  if (platform.device.type === 'desktop') return 'desktop';
  return 'unknown';
}

export class PageTracker {
  private lastPath?: string;
  private lastEnteredAt = 0;
  private installed = false;
  private teardown?: () => void;

  constructor(
    private readonly send: (payload: PageViewPayload) => Promise<void>,
    private readonly getContext: () => {
      sessionId: string;
      userId?: string;
      platform: PlatformAnalysis;
    }
  ) {}

  install() {
    if (typeof window === 'undefined' || this.installed) return;
    this.installed = true;

    const trackCurrent = () => {
      void this.trackPath(window.location.pathname + window.location.search, document.title);
    };

    trackCurrent();

    const onPop = () => trackCurrent();
    window.addEventListener('popstate', onPop);

    const originalPush = history.pushState.bind(history);
    const originalReplace = history.replaceState.bind(history);

    history.pushState = (...args: Parameters<History['pushState']>) => {
      originalPush(...args);
      trackCurrent();
    };
    history.replaceState = (...args: Parameters<History['replaceState']>) => {
      originalReplace(...args);
      trackCurrent();
    };

    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        void this.flushDuration();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);

    this.teardown = () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      history.pushState = originalPush;
      history.replaceState = originalReplace;
    };
  }

  uninstall() {
    void this.flushDuration();
    this.teardown?.();
    this.teardown = undefined;
    this.installed = false;
  }

  async trackPath(path: string, title?: string) {
    if (this.lastPath && this.lastPath !== path) {
      await this.flushDuration();
    }
    if (this.lastPath === path && this.lastEnteredAt) return;

    this.lastPath = path;
    this.lastEnteredAt = Date.now();

    const ctx = this.getContext();
    const platform = resolveDevicePlatform(ctx.platform);

    await this.send({
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      path: path || '/',
      title: title || (typeof document !== 'undefined' ? document.title : undefined),
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      url: typeof location !== 'undefined' ? location.href : undefined,
      platform,
      runtime: ctx.platform.runtime,
      browser: ctx.platform.browser.name,
      os: ctx.platform.device.os,
      engaged: true,
    });
  }

  private async flushDuration() {
    if (!this.lastPath || !this.lastEnteredAt) return;
    const durationMs = Date.now() - this.lastEnteredAt;
    const ctx = this.getContext();
    const platform = resolveDevicePlatform(ctx.platform);

    await this.send({
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      path: this.lastPath,
      title: typeof document !== 'undefined' ? document.title : undefined,
      url: typeof location !== 'undefined' ? location.href : undefined,
      platform,
      runtime: ctx.platform.runtime,
      browser: ctx.platform.browser.name,
      os: ctx.platform.device.os,
      durationMs,
      engaged: durationMs >= 3000,
      metadata: { type: 'duration' },
    });

    this.lastEnteredAt = Date.now();
  }
}
