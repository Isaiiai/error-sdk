import React, { lazy, Suspense } from 'react';
import type { MaintenancePageProps } from './MaintenancePage';
import { SdkLoadingFallback } from './LoadingFallback';

const MaintenancePageLazy = lazy(() =>
  import('./MaintenancePage').then((m) => ({ default: m.MaintenancePage }))
);

/**
 * Lazy-loaded maintenance gate. Prefer this in app roots so the maintenance
 * module is not in the initial bundle until needed.
 */
export function LazyMaintenancePage(props: MaintenancePageProps) {
  return (
    <Suspense fallback={props.children ?? <SdkLoadingFallback fullScreen label="Loading…" />}>
      <MaintenancePageLazy {...props} />
    </Suspense>
  );
}
