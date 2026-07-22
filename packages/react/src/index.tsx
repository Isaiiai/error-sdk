import React, {
  Component,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import type ErrorTracker from '@isaiiai/error-trackers-js-sdk';
import type { SupportRequestInput } from '@isaiiai/error-trackers-js-sdk';
import { ErrorTrackerContext } from './context';
import { SupportPage, type SupportPageProps, type SupportCategory } from './SupportPage';
import { MaintenancePage, type MaintenancePageProps } from './MaintenancePage';

export { ErrorTrackerContext } from './context';
export { SupportPage, MaintenancePage };
export { LazySupportPage } from './LazySupportPage';
export { LazyMaintenancePage } from './LazyMaintenancePage';
export { SdkLoadingFallback } from './LoadingFallback';
export type { SupportPageProps, SupportCategory, MaintenancePageProps };
export type { MaintenanceScreenProps } from './MaintenanceScreen';

export function ErrorTrackerProvider({
  tracker,
  children,
}: {
  tracker: ErrorTracker;
  children: ReactNode;
}) {
  return (
    <ErrorTrackerContext.Provider value={tracker}>{children}</ErrorTrackerContext.Provider>
  );
}

export function useErrorTracker(): ErrorTracker {
  const tracker = useContext(ErrorTrackerContext);
  if (!tracker) {
    throw new Error('useErrorTracker must be used within ErrorTrackerProvider');
  }
  return tracker;
}

interface ErrorBoundaryProps {
  tracker: ErrorTracker;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.tracker.captureException(error, {
      level: 'critical',
      context: { componentStack: info.componentStack },
      tags: { source: 'react-error-boundary' },
    });
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') return fallback(error, this.reset);
      if (fallback) return fallback;
      return (
        <div role="alert" style={{ padding: 24, fontFamily: 'system-ui' }}>
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}</pre>
          <button type="button" onClick={this.reset}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function useErrorBoundary() {
  const tracker = useErrorTracker();
  return {
    captureException: (error: unknown, context?: Parameters<ErrorTracker['captureException']>[1]) =>
      tracker.captureException(error, context),
  };
}

export interface SupportWidgetProps {
  tracker?: ErrorTracker;
  title?: string;
  subtitle?: string;
  position?: 'bottom-right' | 'bottom-left';
  defaultOpen?: boolean;
  buttonLabel?: string;
  /** When set, the FAB navigates to this URL instead of opening the popup form */
  pageHref?: string;
}

const categories: Array<{ value: SupportCategory; label: string }> = [
  { value: 'feature_request', label: 'New feature' },
  { value: 'bug', label: 'Bug report' },
  { value: 'performance', label: 'Performance' },
  { value: 'security', label: 'Security' },
  { value: 'question', label: 'Question' },
  { value: 'other', label: 'Other' },
];

async function fileToDataUrl(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
  return {
    filename: file.name,
    dataUrl,
    contentType: file.type || 'application/octet-stream',
  };
}

export function SupportWidget({
  tracker: trackerProp,
  title = 'Customer Care',
  subtitle = 'Report a bug, request a feature, or ask for help.',
  position = 'bottom-right',
  defaultOpen = false,
  buttonLabel = 'Support',
  pageHref,
}: SupportWidgetProps) {
  const ctxTracker = useContext(ErrorTrackerContext);
  const tracker = trackerProp || ctxTracker;

  const [open, setOpen] = useState(defaultOpen);
  const [category, setCategory] = useState<SupportCategory>('feature_request');
  const [form, setForm] = useState({
    title: '',
    description: '',
    reporterName: '',
    reporterEmail: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const fabStyle = useMemo<CSSProperties>(
    () => ({
      position: 'fixed',
      bottom: 20,
      ...(position === 'bottom-right' ? { right: 20 } : { left: 20 }),
      zIndex: 2147483000,
    }),
    [position]
  );

  if (!tracker) return null;

  if (pageHref) {
    return (
      <div style={fabStyle}>
        <a href={pageHref} style={{ ...fabButtonStyle, textDecoration: 'none', display: 'inline-block' }}>
          {buttonLabel}
        </a>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setStatus('error');
      setMessage('Title and description are required.');
      return;
    }
    setStatus('submitting');
    setMessage('');
    try {
      const attachments = await Promise.all(files.slice(0, 5).map(fileToDataUrl));
      const result = await tracker.submitSupportRequest({
        title: form.title.trim(),
        description: form.description.trim(),
        category,
        reporterName: form.reporterName.trim() || undefined,
        reporterEmail: form.reporterEmail.trim() || undefined,
        attachments,
        tags: ['sdk-widget'],
      });
      setStatus('success');
      setMessage(
        result.ticketNumber
          ? `Submitted ${result.ticketNumber}. Our team will follow up shortly.`
          : 'Submitted successfully. Our team will follow up shortly.'
      );
      setForm({ title: '', description: '', reporterName: '', reporterEmail: '' });
      setFiles([]);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to submit request');
    }
  };

  return (
    <div style={fabStyle}>
      {open && (
        <div style={panelStyle}>
          <div style={headerStyle}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{subtitle}</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} style={closeBtnStyle} aria-label="Close">
              ×
            </button>
          </div>

          <form onSubmit={onSubmit} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={labelStyle}>
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SupportCategory)}
                style={inputStyle}
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              Title
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Short summary"
                style={inputStyle}
                required
              />
            </label>

            <label style={labelStyle}>
              Details
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the issue or feature request"
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                required
              />
            </label>

            <label style={labelStyle}>
              Your name
              <input
                value={form.reporterName}
                onChange={(e) => setForm({ ...form, reporterName: e.target.value })}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Email
              <input
                type="email"
                value={form.reporterEmail}
                onChange={(e) => setForm({ ...form, reporterEmail: e.target.value })}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Attachments
              <input
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}
                style={{ marginTop: 4, fontSize: 12 }}
              />
            </label>

            {message && (
              <div
                style={{
                  fontSize: 12,
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: status === 'error' ? '#FEE4E2' : '#DCFAE6',
                  color: status === 'error' ? '#B42318' : '#027A48',
                }}
              >
                {message}
              </div>
            )}

            <button type="submit" disabled={status === 'submitting'} style={submitStyle}>
              {status === 'submitting' ? 'Sending…' : 'Submit report'}
            </button>
          </form>
        </div>
      )}

      <button type="button" onClick={() => setOpen((v) => !v)} style={fabButtonStyle}>
        {open ? 'Close' : buttonLabel}
      </button>
    </div>
  );
}

const panelStyle: CSSProperties = {
  width: 340,
  maxWidth: 'calc(100vw - 32px)',
  marginBottom: 12,
  background: 'rgba(12,12,18,.96)',
  color: '#fff',
  borderRadius: 16,
  boxShadow: '0 16px 48px rgba(0,0,0,0.45), 0 0 40px rgba(216,27,96,0.18)',
  border: '1px solid rgba(255,255,255,.1)',
  overflow: 'hidden',
  fontFamily: 'Inter, system-ui, sans-serif',
  backdropFilter: 'blur(16px)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '14px 16px',
  background: 'linear-gradient(135deg, #D81B60, #7C3AED, #1E88E5)',
  color: '#fff',
};

const closeBtnStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#fff',
  fontSize: 22,
  cursor: 'pointer',
  lineHeight: 1,
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  fontWeight: 600,
  color: '#CFCFD8',
};

const inputStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,.14)',
  fontSize: 13,
  fontWeight: 400,
  fontFamily: 'inherit',
  background: 'rgba(255,255,255,.06)',
  color: '#fff',
};

const submitStyle: CSSProperties = {
  marginTop: 4,
  padding: '10px 12px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg, #D81B60, #7C3AED, #1E88E5)',
  color: '#fff',
  fontWeight: 650,
  cursor: 'pointer',
};

const fabButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '12px 18px',
  background: 'linear-gradient(135deg, #D81B60, #7C3AED, #1E88E5)',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 8px 28px rgba(124,58,237,0.45)',
  fontFamily: 'Inter, system-ui, sans-serif',
};

export default ErrorBoundary;
