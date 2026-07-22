import React, {
  lazy,
  Suspense,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type ErrorTracker from '@isaiiai/error-trackers-js-sdk';
import type { MaintenanceStatus } from '@isaiiai/error-trackers-js-sdk';
import { ErrorTrackerContext } from './context';
import { SdkLoadingFallback } from './LoadingFallback';

export type { MaintenanceScreenProps } from './MaintenanceScreen';

export interface MaintenancePageProps {
  tracker?: ErrorTracker;
  /** When false, children always render (useful for testing) */
  enabled?: boolean;
  /** Custom brand / product name override */
  brandName?: string;
  /** Logo image URL (defaults to /isaii-logo.png in the host app public folder) */
  logoSrc?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const MaintenanceScreenLazy = lazy(() =>
  import('./MaintenanceScreen').then((m) => ({ default: m.MaintenanceScreen }))
);

/**
 * Thin maintenance gate. The heavy Isaii UI is lazy-loaded only when
 * maintenance becomes active.
 */
export function MaintenancePage({
  tracker: trackerProp,
  enabled = true,
  brandName = 'Isaii AI',
  logoSrc = '/isaii-logo.png',
  children,
  className,
  style,
}: MaintenancePageProps) {
  const ctxTracker = useContext(ErrorTrackerContext);
  const tracker = trackerProp || ctxTracker;
  const [status, setStatus] = useState<MaintenanceStatus>(() =>
    tracker?.getMaintenanceStatus?.() || { active: false, windows: [] }
  );

  useEffect(() => {
    if (!tracker || !enabled) return;
    void tracker.refreshMaintenance?.();
    return tracker.onMaintenanceChange?.(setStatus);
  }, [tracker, enabled]);

  useEffect(() => {
    if (!enabled || !status.active || typeof document === 'undefined') return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [enabled, status.active]);

  if (!enabled || !status.active) {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={<SdkLoadingFallback fullScreen label="Loading maintenance…" />}>
      <MaintenanceScreenLazy
        status={status}
        brandName={brandName}
        logoSrc={logoSrc}
        className={className}
        style={style}
      />
    </Suspense>
  );
}
