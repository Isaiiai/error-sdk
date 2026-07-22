import React, { lazy, Suspense } from 'react';
import type { SupportPageProps } from './SupportPage';
import { SdkLoadingFallback } from './LoadingFallback';

const SupportPageLazy = lazy(() =>
  import('./SupportPage').then((m) => ({ default: m.SupportPage }))
);

/** Lazy-loaded Help Center / Support page with Suspense fallback. */
export function LazySupportPage(props: SupportPageProps) {
  return (
    <Suspense fallback={<SdkLoadingFallback label="Loading help center…" />}>
      <SupportPageLazy {...props} />
    </Suspense>
  );
}
