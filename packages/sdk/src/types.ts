export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Environment = 'development' | 'staging' | 'production';

export interface Breadcrumb {
  timestamp?: string;
  category: string;
  message: string;
  level?: string;
  data?: Record<string, unknown>;
}

export interface ScreenshotAttachment {
  data: string;
  contentType: string;
  width: number;
  height: number;
  capturedAt: string;
}

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

export interface ErrorEvent {
  id?: string;
  timestamp: string;
  message: string;
  errorType: string;
  severity: Severity;
  stackTrace: string;
  sourceMap?: {
    file?: string;
    line?: number;
    column?: number;
  };
  environment: Environment | string;
  version: string;
  browser: {
    name: string;
    version: string;
    userAgent: string;
  };
  device: {
    type: 'mobile' | 'tablet' | 'desktop';
    os: string;
  };
  url: string;
  user?: {
    id: string;
    username?: string;
    email?: string;
    customData?: Record<string, unknown>;
  };
  sessionId: string;
  breadcrumbs: Breadcrumb[];
  context?: {
    customData: Record<string, unknown>;
    tags: string[];
    release?: string;
  };
  fingerprint?: string[];
  /** JPEG/PNG data URL captured at error time */
  screenshot?: ScreenshotAttachment;
  /** Frontend / webview platform analysis */
  platform?: Record<string, unknown>;
  /** HTTP requests captured before this error */
  networkActivity?: NetworkActivityEntry[];
}

export interface ErrorTrackerConfig {
  projectKey: string;
  secretKey: string;
  dsn: string;
  environment?: Environment | string;
  version?: string;
  enableSourceMaps?: boolean;
  sampleRate?: number;
  maxBreadcrumbs?: number;
  /** Record fetch/XHR traffic leading up to errors (default: true) */
  captureNetworkActivity?: boolean;
  maxNetworkEntries?: number;
  beforeSend?: (event: ErrorEvent) => ErrorEvent | null;
  debug?: boolean;
  release?: string;
  maxRequestBodyLength?: number;
  maxResponseBodyLength?: number;
  captureUnhandledRejections?: boolean;
  captureConsoleErrors?: boolean;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  /** Capture a viewport screenshot when an error occurs (default: true) */
  captureScreenshot?: boolean;
  screenshotQuality?: number;
  screenshotMaxWidth?: number;
  screenshotMaxHeight?: number;
  /** Auto-track SPA page views for engagement analytics (default: true) */
  trackPageViews?: boolean;
  /** Poll backend for active maintenance and expose to UI (default: true) */
  checkMaintenance?: boolean;
  maintenancePollIntervalMs?: number;
}

export interface CaptureContext {
  level?: Severity;
  context?: Record<string, unknown>;
  tags?: Record<string, string>;
  fingerprint?: string[];
  /** Override global screenshot setting for this capture */
  captureScreenshot?: boolean;
}

export interface UserContext {
  id: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
}
