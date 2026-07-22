export type RuntimePlatform =
  | 'browser'
  | 'ios-webview'
  | 'android-webview'
  | 'react-native-webview'
  | 'cordova'
  | 'ionic'
  | 'electron'
  | 'capacitor'
  | 'unknown';

export interface PlatformAnalysis {
  runtime: RuntimePlatform;
  isWebView: boolean;
  framework: {
    react?: boolean;
    vue?: boolean;
    angular?: boolean;
    next?: boolean;
    svelte?: boolean;
  };
  browser: {
    name: string;
    version: string;
    userAgent: string;
    language: string;
    languages: string[];
    cookiesEnabled: boolean;
    online: boolean;
  };
  device: {
    type: 'mobile' | 'tablet' | 'desktop';
    os: string;
    touch: boolean;
    deviceMemory?: number;
    hardwareConcurrency?: number;
    maxTouchPoints?: number;
  };
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    pixelRatio: number;
    colorDepth: number;
    orientation?: string;
  };
  viewport: {
    width: number;
    height: number;
  };
  network?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
  page: {
    url: string;
    title: string;
    referrer: string;
    visibilityState?: string;
  };
  webview: {
    reactNative?: boolean;
    flutter?: boolean;
    wkWebView?: boolean;
    androidWebView?: boolean;
    cordova?: boolean;
    capacitor?: boolean;
    ionic?: boolean;
  };
  analyzedAt: string;
}

export function analyzePlatform(): PlatformAnalysis {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return emptyAnalysis();
  }

  const ua = navigator.userAgent || '';
  const webview = detectWebView(ua);
  const runtime = resolveRuntime(ua, webview);
  const browser = parseBrowser(ua);
  const device = detectDevice(ua);

  const connection =
    (navigator as Navigator & { connection?: NetworkInformation }).connection ||
    (navigator as Navigator & { mozConnection?: NetworkInformation }).mozConnection ||
    (navigator as Navigator & { webkitConnection?: NetworkInformation }).webkitConnection;

  return {
    runtime,
    isWebView: runtime !== 'browser' && runtime !== 'electron' && runtime !== 'unknown',
    framework: detectFrameworks(),
    browser: {
      name: browser.name,
      version: browser.version,
      userAgent: ua,
      language: navigator.language || '',
      languages: Array.from(navigator.languages || []),
      cookiesEnabled: navigator.cookieEnabled,
      online: navigator.onLine,
    },
    device: {
      type: device.type,
      os: device.os,
      touch: 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      maxTouchPoints: navigator.maxTouchPoints,
    },
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      pixelRatio: window.devicePixelRatio || 1,
      colorDepth: screen.colorDepth,
      orientation: screen.orientation?.type,
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    network: connection
      ? {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        }
      : undefined,
    page: {
      url: location.href,
      title: document.title,
      referrer: document.referrer,
      visibilityState: document.visibilityState,
    },
    webview,
    analyzedAt: new Date().toISOString(),
  };
}

interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

function detectWebView(ua: string) {
  const win = window as Window & {
    ReactNativeWebView?: unknown;
    flutter_inappwebview?: unknown;
    cordova?: unknown;
    Capacitor?: unknown;
    Ionic?: unknown;
  };

  return {
    reactNative: !!(win.ReactNativeWebView || /ReactNative|rnwebview/i.test(ua)),
    flutter: !!(win.flutter_inappwebview || /Flutter/i.test(ua)),
    wkWebView:
      (/iPhone|iPad|iPod/.test(ua) && /AppleWebKit/.test(ua) && !/Safari\//.test(ua)) ||
      /WKWebView/i.test(ua) ||
      !!(window as Window & { webkit?: { messageHandlers?: unknown } }).webkit?.messageHandlers,
    androidWebView: /Android/.test(ua) && /wv\)/.test(ua),
    cordova: !!win.cordova || /Cordova|PhoneGap/i.test(ua),
    capacitor: !!win.Capacitor,
    ionic: !!win.Ionic || /Ionic/i.test(ua),
  };
}

function resolveRuntime(
  ua: string,
  webview: ReturnType<typeof detectWebView>
): RuntimePlatform {
  if (/Electron/i.test(ua)) return 'electron';
  if (webview.reactNative) return 'react-native-webview';
  if (webview.capacitor) return 'capacitor';
  if (webview.cordova) return 'cordova';
  if (webview.ionic) return 'ionic';
  if (webview.wkWebView) return 'ios-webview';
  if (webview.androidWebView) return 'android-webview';
  if (typeof window !== 'undefined') return 'browser';
  return 'unknown';
}

function detectFrameworks() {
  const win = window as Window & {
    React?: unknown;
    Vue?: unknown;
    ng?: unknown;
    angular?: unknown;
    __NEXT_DATA__?: unknown;
    Svelte?: unknown;
  };
  return {
    react: !!(win.React || document.querySelector('[data-reactroot], [data-reactid]')),
    vue: !!(win.Vue || document.querySelector('[data-v-]')),
    angular: !!(win.ng || win.angular || document.querySelector('[ng-version]')),
    next: !!win.__NEXT_DATA__,
    svelte: !!document.querySelector('[class*="svelte-"]'),
  };
}

function parseBrowser(ua: string): { name: string; version: string } {
  const patterns: Array<[RegExp, string]> = [
    [/edg\/([\d.]+)/i, 'Edge'],
    [/chrome\/([\d.]+)/i, 'Chrome'],
    [/firefox\/([\d.]+)/i, 'Firefox'],
    [/version\/([\d.]+).*safari/i, 'Safari'],
    [/opr\/([\d.]+)/i, 'Opera'],
  ];
  for (const [re, name] of patterns) {
    const m = ua.match(re);
    if (m) return { name, version: m[1] };
  }
  return { name: 'Unknown', version: '' };
}

function detectDevice(ua: string): { type: 'mobile' | 'tablet' | 'desktop'; os: string } {
  const isTablet = /ipad|tablet|playbook|silk/i.test(ua);
  const isMobile = /mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua);
  let os = 'Unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac os/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  return { type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop', os };
}

function emptyAnalysis(): PlatformAnalysis {
  return {
    runtime: 'unknown',
    isWebView: false,
    framework: {},
    browser: {
      name: 'Unknown',
      version: '',
      userAgent: '',
      language: '',
      languages: [],
      cookiesEnabled: false,
      online: false,
    },
    device: { type: 'desktop', os: 'Unknown', touch: false },
    screen: {
      width: 0,
      height: 0,
      availWidth: 0,
      availHeight: 0,
      pixelRatio: 1,
      colorDepth: 0,
    },
    viewport: { width: 0, height: 0 },
    page: { url: '', title: '', referrer: '' },
    webview: {},
    analyzedAt: new Date().toISOString(),
  };
}
