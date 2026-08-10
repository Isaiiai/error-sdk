import React, { useEffect, useState, type CSSProperties } from 'react';
import type { MaintenanceStatus } from '@isaiiai/error-trackers-js-sdk';

export interface MaintenanceScreenProps {
  status: MaintenanceStatus;
  brandName?: string;
  logoSrc?: string;
  className?: string;
  style?: CSSProperties;
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
      <style>{`
        @keyframes et-float-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -40px) scale(1.1); }
        }
        @keyframes et-float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 30px) scale(0.95); }
        }
        @keyframes et-float-3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-45%, -55%) scale(1.05); }
        }
        .et-orb-1 {
          animation: et-float-1 20s infinite ease-in-out;
        }
        .et-orb-2 {
          animation: et-float-2 25s infinite ease-in-out;
        }
        .et-orb-3 {
          animation: et-float-3 18s infinite ease-in-out;
        }
        .et-card {
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .et-card:hover {
          border-color: rgba(255, 255, 255, 0.12) !important;
          box-shadow: 0 35px 80px rgba(0, 0, 0, 0.7), 0 0 100px rgba(30, 136, 229, 0.08) !important;
        }
        .et-btn {
          padding: 12px 26px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 14px;
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-family: inherit;
        }
        .et-btn-primary {
          background: linear-gradient(135deg, #D81B60 0%, #7C3AED 50%, #1E88E5 100%);
          background-size: 200% auto;
          color: #fff;
          border: none;
          box-shadow: 0 4px 20px rgba(124, 58, 237, 0.25);
        }
        .et-btn-primary:hover {
          background-position: right center;
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(124, 58, 237, 0.45);
        }
        .et-btn-secondary {
          background: rgba(255, 255, 255, 0.04);
          color: #E2E8F0;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .et-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          color: #fff;
          transform: translateY(-2px);
        }
      `}</style>

      <div style={bgLayer} aria-hidden>
        <div className="et-orb-1" style={{ ...orb, ...orbMagenta }} />
        <div className="et-orb-2" style={{ ...orb, ...orbBlue }} />
        <div className="et-orb-3" style={{ ...orb, ...orbCyan }} />
        <div style={gridOverlay} />
      </div>

      <div className="et-card" style={card}>
        <div style={logoWrap}>
          {!logoFailed ? (
            <img
              src={logoSrc}
              alt={brandName}
              width={96}
              height={96}
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
          The system is under <span style={gradientText}>Maintenance</span>
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

        <div style={buttonsRow}>
          <a href="mailto:support@isaii.in" className="et-btn et-btn-primary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            Contact support
          </a>
          <a href="https://isaii.in" target="_blank" rel="noreferrer" className="et-btn et-btn-secondary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Visit Website
          </a>
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
  opacity: 0.5,
  transition: 'all 1s ease',
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

const card: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: '100%',
  maxWidth: 680,
  padding: 'clamp(32px, 6vw, 56px) clamp(24px, 5vw, 48px)',
  borderRadius: 28,
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55), 0 0 80px rgba(216, 27, 96, 0.06)',
  textAlign: 'center',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const logoWrap: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: 20,
};

const logoImg: CSSProperties = {
  width: 96,
  height: 96,
  objectFit: 'contain',
  borderRadius: 22,
  background: '#fff',
  padding: 10,
  boxShadow: '0 0 40px rgba(30,136,229,.35)',
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
  background: 'rgba(216, 27, 96, 0.16)',
  border: '1px solid rgba(216, 27, 96, 0.32)',
  color: '#F9A8D4',
  fontSize: 13,
  letterSpacing: 0.4,
  marginBottom: 20,
};

const headline: CSSProperties = {
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 'clamp(28px, 6vw, 46px)',
  lineHeight: 1.15,
  margin: '0 0 16px 0',
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
  fontSize: 'clamp(14px, 2vw, 16px)',
  lineHeight: 1.7,
  maxWidth: 540,
  margin: '0 auto 8px auto',
};

const metaRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 12,
  marginBottom: 8,
};

const metaPill: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 999,
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  fontSize: 12,
  color: '#CFCFD8',
  textTransform: 'capitalize',
};

const buttonsRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 16,
  marginTop: 28,
  flexWrap: 'wrap',
};

const footer: CSSProperties = {
  marginTop: 40,
  color: '#666',
  fontSize: 12,
  letterSpacing: '0.05em',
};
