import React, { type CSSProperties } from 'react';

/** Lightweight placeholder while Support / Maintenance chunks load. */
export function SdkLoadingFallback({
  label = 'Loading…',
  fullScreen = false,
}: {
  label?: string;
  fullScreen?: boolean;
}) {
  const shell: CSSProperties = fullScreen
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#06060B',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
      }
    : {
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#06060B',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
      };

  return (
    <div style={shell} role="status" aria-live="polite" aria-busy="true">
      <div style={{ textAlign: 'center' }}>
        <div style={spinner} />
        <div
          style={{
            marginTop: 16,
            fontSize: 14,
            color: '#B5B5C3',
            background: 'linear-gradient(90deg, #D81B60, #1E88E5)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontWeight: 600,
          }}
        >
          {label}
        </div>
      </div>
      <style>{`
        @keyframes et-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const spinner: CSSProperties = {
  width: 36,
  height: 36,
  margin: '0 auto',
  borderRadius: '50%',
  border: '3px solid rgba(255,255,255,.12)',
  borderTopColor: '#D81B60',
  borderRightColor: '#1E88E5',
  animation: 'et-spin .8s linear infinite',
};
