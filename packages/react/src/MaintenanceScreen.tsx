import React, { useEffect, useState, type CSSProperties } from 'react';
import type { MaintenanceStatus } from '@isaiiai/error-trackers-js-sdk';

export interface MaintenanceScreenProps {
  status: MaintenanceStatus;
  brandName?: string;
  logoSrc?: string;
  className?: string;
  style?: CSSProperties;
}

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, '0');
}

function useCountdown(endIso?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const end = endIso ? new Date(endIso).getTime() : Date.now() + 2 * 60 * 60 * 1000;
  const diff = Math.max(0, end - now);
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

/** Heavy Isaii maintenance UI — loaded on demand when maintenance is active. */
export function MaintenanceScreen({
  status,
  brandName = 'Isaii AI',
  logoSrc = '/isaii-logo.png',
  className,
  style,
}: MaintenanceScreenProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const windowInfo = status.windows[0];
  const countdown = useCountdown(windowInfo?.endTime);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'et-isaii-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);

  const description =
    windowInfo?.description ||
    'Our engineers are deploying improvements for a faster, smarter experience. We’ll be back online shortly — thank you for your patience.';

  return (
    <div style={{ ...shell, ...style }} className={className} role="status" aria-live="polite">
      <div style={bgLayer} aria-hidden>
        <div style={{ ...orb, ...orbMagenta }} />
        <div style={{ ...orb, ...orbBlue }} />
        <div style={{ ...orb, ...orbCyan }} />
        <div style={gridOverlay} />
      </div>

      <div style={content}>
        <div style={logoWrap}>
          {!logoFailed ? (
            <img
              src={logoSrc}
              alt={brandName}
              width={112}
              height={112}
              style={logoImg}
              loading="lazy"
              decoding="async"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div style={logoFallback}>
              <span style={logoFallbackText}>Isaii</span>
              <span style={logoFallbackAi}>AI</span>
            </div>
          )}
        </div>

        <div style={badge}>Platform upgrade in progress</div>

        <h1 style={headline}>
          We are under <span style={gradientText}>Maintenance</span>
        </h1>

        <p style={subcopy}>{description}</p>

        {windowInfo?.title || windowInfo?.severity ? (
          <div style={metaRow}>
            {windowInfo?.title ? <span style={metaPill}>{windowInfo.title}</span> : null}
            {windowInfo?.severity ? (
              <span style={metaPill}>Severity · {windowInfo.severity}</span>
            ) : null}
          </div>
        ) : null}

        <div style={countdownRow}>
          {[
            { label: 'Days', value: countdown.days },
            { label: 'Hours', value: countdown.hours },
            { label: 'Minutes', value: countdown.minutes },
            { label: 'Seconds', value: countdown.seconds },
          ].map((t) => (
            <div key={t.label} style={timeBox}>
              <div style={timeValue}>{pad(t.value)}</div>
              <div style={timeLabel}>{t.label}</div>
            </div>
          ))}
        </div>

        <div style={footer}>
          © {new Date().getFullYear()} {brandName || status.projectName || 'Isaii AI'}
        </div>
      </div>
    </div>
  );
}

const shell: CSSProperties = {
  position: 'fixed',
  inset: 0,
  width: '100vw',
  height: '100vh',
  maxWidth: '100%',
  maxHeight: '100%',
  zIndex: 2147483000,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'clamp(16px, 4vw, 40px)',
  background: '#06060B',
  color: '#fff',
  fontFamily: 'Inter, system-ui, sans-serif',
  boxSizing: 'border-box',
};

const bgLayer: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
};

const orb: CSSProperties = {
  position: 'absolute',
  borderRadius: '50%',
  filter: 'blur(100px)',
  opacity: 0.55,
};

const orbMagenta: CSSProperties = {
  width: 480,
  height: 480,
  background: '#D81B60',
  top: -140,
  left: -140,
};

const orbBlue: CSSProperties = {
  width: 440,
  height: 440,
  background: '#1E88E5',
  right: -140,
  bottom: -140,
};

const orbCyan: CSSProperties = {
  width: 320,
  height: 320,
  background: '#06B6D4',
  left: '50%',
  top: '62%',
  transform: 'translate(-50%, -50%)',
  opacity: 0.4,
};

const gridOverlay: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)',
  backgroundSize: '40px 40px',
  maskImage: 'radial-gradient(circle at center, black 35%, transparent 90%)',
  WebkitMaskImage: 'radial-gradient(circle at center, black 35%, transparent 90%)',
};

const content: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: '100%',
  maxWidth: 760,
  textAlign: 'center',
};

const logoWrap: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: 22,
};

const logoImg: CSSProperties = {
  width: 112,
  height: 112,
  objectFit: 'contain',
  borderRadius: 24,
  background: '#fff',
  padding: 10,
  boxShadow: '0 0 48px rgba(30,136,229,.4)',
};

const logoFallback: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 4,
  padding: '14px 20px',
  borderRadius: 16,
  background: '#fff',
};

const logoFallbackText: CSSProperties = {
  fontFamily: '"Space Grotesk", sans-serif',
  fontWeight: 700,
  fontSize: 32,
  background: 'linear-gradient(180deg, #1E88E5 0%, #D81B60 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const logoFallbackAi: CSSProperties = {
  ...logoFallbackText,
  fontSize: 18,
};

const badge: CSSProperties = {
  display: 'inline-block',
  padding: '8px 16px',
  borderRadius: 50,
  background: 'rgba(216,27,96,.16)',
  border: '1px solid rgba(216,27,96,.32)',
  color: '#F9A8D4',
  fontSize: 13,
  letterSpacing: 0.4,
  marginBottom: 18,
};

const headline: CSSProperties = {
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 'clamp(34px, 7vw, 58px)',
  lineHeight: 1.08,
  margin: '0 0 18px',
  fontWeight: 700,
  letterSpacing: '-0.02em',
};

const gradientText: CSSProperties = {
  background: 'linear-gradient(90deg, #D81B60, #7C3AED, #1E88E5, #22D3EE)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const subcopy: CSSProperties = {
  color: '#B5B5C3',
  fontSize: 'clamp(15px, 2.2vw, 18px)',
  lineHeight: 1.75,
  maxWidth: 620,
  margin: '0 auto',
};

const metaRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 16,
};

const metaPill: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 999,
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.1)',
  fontSize: 12,
  color: '#CFCFD8',
  textTransform: 'capitalize',
};

const countdownRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 14,
  margin: '40px 0 0',
  flexWrap: 'wrap',
};

const timeBox: CSSProperties = {
  width: 104,
  padding: '18px 12px',
  borderRadius: 18,
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(255,255,255,.08)',
};

const timeValue: CSSProperties = {
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 38,
  fontWeight: 700,
};

const timeLabel: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: '#999',
  marginTop: 4,
};

const footer: CSSProperties = {
  marginTop: 48,
  color: '#777',
  fontSize: 13,
};
