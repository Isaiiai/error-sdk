import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type ErrorTracker from '@error-tracker/js-sdk';
import type { SupportRequestInput } from '@error-tracker/js-sdk';
import { ErrorTrackerContext } from './context';

export type SupportCategory = NonNullable<SupportRequestInput['category']>;

const categories: Array<{ value: SupportCategory; label: string; hint: string }> = [
  { value: 'feature_request', label: 'New feature', hint: 'Suggest an improvement' },
  { value: 'bug', label: 'Bug report', hint: 'Something is broken' },
  { value: 'performance', label: 'Performance', hint: 'Slow or laggy' },
  { value: 'security', label: 'Security', hint: 'Privacy or access issue' },
  { value: 'question', label: 'Question', hint: 'Need help using the product' },
  { value: 'other', label: 'Other', hint: 'Anything else' },
];

const statusTone: Record<string, { bg: string; fg: string; border: string }> = {
  open: { bg: 'rgba(30,136,229,.18)', fg: '#93C5FD', border: 'rgba(30,136,229,.35)' },
  in_progress: { bg: 'rgba(245,158,11,.16)', fg: '#FCD34D', border: 'rgba(245,158,11,.35)' },
  waiting_for_customer: { bg: 'rgba(124,58,237,.18)', fg: '#C4B5FD', border: 'rgba(124,58,237,.35)' },
  resolved: { bg: 'rgba(34,197,94,.16)', fg: '#86EFAC', border: 'rgba(34,197,94,.35)' },
  closed: { bg: 'rgba(255,255,255,.06)', fg: '#CFCFD8', border: 'rgba(255,255,255,.12)' },
};

export interface SupportPageProps {
  tracker?: ErrorTracker;
  title?: string;
  subtitle?: string;
  defaultEmail?: string;
  headerAction?: ReactNode;
  brandName?: string;
  logoSrc?: string;
  className?: string;
  style?: CSSProperties;
}

type View = 'list' | 'create' | 'detail';

type TicketRow = {
  _id: string;
  ticketNumber: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  category?: string;
  createdAt: string;
  attachments?: Array<{ filename: string; url?: string; contentType?: string; size?: number }>;
  comments?: Array<{
    content: string;
    authorName?: string;
    authorId?: { fullName?: string };
    createdAt: string;
  }>;
  customFields?: { pageUrl?: string };
  reporterName?: string;
  reporterEmail?: string;
};

async function fileToDataUrl(file: File): Promise<{ filename: string; dataUrl: string; contentType: string }> {
  if (file.size > 4 * 1024 * 1024) {
    throw new Error(`${file.name} exceeds the 4MB limit`);
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
  if (!dataUrl.startsWith('data:')) {
    throw new Error(`Could not encode ${file.name}`);
  }
  return {
    filename: file.name,
    dataUrl,
    contentType: file.type || 'application/octet-stream',
  };
}

function formatBytes(n?: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function ensureIsaiiFonts() {
  if (typeof document === 'undefined') return;
  const id = 'et-isaii-fonts';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap';
  document.head.appendChild(link);
}

function StatusPill({ status }: { status: string }) {
  const tone = statusTone[status] || statusTone.open;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'capitalize',
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function SupportPage({
  tracker: trackerProp,
  title = 'Help Center',
  subtitle = 'Create tickets, attach files, and follow up with our team.',
  defaultEmail = '',
  headerAction,
  brandName = 'Isaii AI',
  logoSrc = '/isaii-logo.png',
  className,
  style,
}: SupportPageProps) {
  const ctxTracker = useContext(ErrorTrackerContext);
  const tracker = trackerProp || ctxTracker;

  const [view, setView] = useState<View>('list');
  const [email, setEmail] = useState(defaultEmail);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [logoFailed, setLogoFailed] = useState(false);

  const [category, setCategory] = useState<SupportCategory>('feature_request');
  const [priority, setPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [form, setForm] = useState({
    title: '',
    description: '',
    reporterName: '',
    reporterEmail: defaultEmail,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    ensureIsaiiFonts();
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.background;
    const prevBodyBg = body.style.background;
    const prevBodyMargin = body.style.margin;
    html.style.background = '#06060B';
    body.style.background = '#06060B';
    body.style.margin = '0';
    return () => {
      html.style.background = prevHtmlBg;
      body.style.background = prevBodyBg;
      body.style.margin = prevBodyMargin;
    };
  }, []);

  const stats = useMemo(() => {
    const open = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
    return { total: tickets.length, open };
  }, [tickets]);

  const loadTickets = useCallback(async () => {
    if (!tracker) return;
    setLoading(true);
    setError('');
    try {
      const list = await tracker.listSupportTickets({
        email: email.trim() || undefined,
      });
      setTickets(list as TicketRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [tracker, email]);

  useEffect(() => {
    if (view === 'list') void loadTickets();
  }, [view, loadTickets]);

  if (!tracker) {
    return (
      <div style={{ ...pageShell, ...style }} className={className}>
        <p style={{ color: '#B5B5C3' }}>Error tracker is not configured.</p>
      </div>
    );
  }

  const openTicket = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const ticket = (await tracker.getSupportTicket(id, email.trim() || undefined)) as TicketRow;
      setSelected(ticket);
      setView('detail');
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      let attachments: Array<{ filename: string; dataUrl: string; contentType: string }> = [];
      try {
        attachments = await Promise.all(files.slice(0, 5).map(fileToDataUrl));
      } catch (fileErr) {
        setError(fileErr instanceof Error ? fileErr.message : 'Failed to read attachment');
        setSubmitting(false);
        return;
      }
      const result = await tracker.submitSupportRequest({
        title: form.title.trim(),
        description: form.description.trim(),
        category,
        priority,
        reporterName: form.reporterName.trim() || undefined,
        reporterEmail: form.reporterEmail.trim() || undefined,
        attachments,
        tags: ['sdk-support-page', 'isaii'],
      });
      setSuccessMsg(
        result.ticketNumber
          ? `Created ${result.ticketNumber}${
              result.attachmentCount
                ? ` with ${result.attachmentCount} attachment(s)`
                : files.length
                  ? ' (warning: attachments were not saved)'
                  : ''
            }.`
          : 'Ticket submitted successfully.'
      );
      if (files.length && !result.attachmentCount) {
        setError('Ticket created, but attachments failed to upload. Try a smaller file.');
      }
      if (form.reporterEmail.trim()) setEmail(form.reporterEmail.trim());
      setForm({
        title: '',
        description: '',
        reporterName: form.reporterName,
        reporterEmail: form.reporterEmail,
      });
      setFiles([]);
      setView('list');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const onComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !comment.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await tracker.addSupportComment(selected._id, {
        content: comment.trim(),
        authorName: form.reporterName || selected.reporterName,
        email: email.trim() || selected.reporterEmail,
      });
      setComment('');
      await openTicket(selected._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const addFiles = (list: FileList | File[]) => {
    const next = [...files, ...Array.from(list)].slice(0, 5);
    const oversized = next.filter((f) => f.size > 4 * 1024 * 1024);
    if (oversized.length) {
      setError(`${oversized[0].name} exceeds the 4MB limit`);
    }
    setFiles(next.filter((f) => f.size <= 4 * 1024 * 1024));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div style={{ ...pageShell, ...style }} className={className}>
      <div style={bgLayer} aria-hidden>
        <div style={{ ...orb, ...orbMagenta }} />
        <div style={{ ...orb, ...orbBlue }} />
        <div style={{ ...orb, ...orbCyan }} />
        <div style={gridOverlay} />
      </div>

      <div style={inner}>
        <div style={heroBand}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {!logoFailed ? (
              <img
                src={logoSrc}
                alt={brandName}
                width={64}
                height={64}
                style={logoImg}
                loading="lazy"
                decoding="async"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div style={logoFallback}>
                <span style={logoFallbackText}>Isaii</span>
                <span style={{ ...logoFallbackText, fontSize: 14 }}>AI</span>
              </div>
            )}
            <div>
              <div style={eyebrow}>{brandName} · Customer care</div>
              <h1 style={heroTitle}>
                {title.split(' ').slice(0, -1).join(' ')}{' '}
                <span style={gradientText}>{title.split(' ').slice(-1)[0]}</span>
              </h1>
              <p style={heroSub}>{subtitle}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {headerAction}
            {view !== 'create' && (
              <button type="button" style={primaryBtn} onClick={() => setView('create')}>
                New ticket
              </button>
            )}
            {view !== 'list' && (
              <button type="button" style={ghostBtn} onClick={() => setView('list')}>
                All tickets
              </button>
            )}
          </div>
        </div>

        {view === 'list' && (
          <div style={statsRow}>
            <div style={statCard}>
              <div style={statLabel}>Your tickets</div>
              <div style={statValue}>{stats.total}</div>
            </div>
            <div style={statCard}>
              <div style={statLabel}>Open / active</div>
              <div style={statValue}>{stats.open}</div>
            </div>
          </div>
        )}

        {(error || successMsg) && (
          <div
            style={{
              ...alertStyle,
              background: error ? 'rgba(248,113,113,0.15)' : 'rgba(34,197,94,0.15)',
              color: error ? '#FCA5A5' : '#86EFAC',
              border: `1px solid ${error ? 'rgba(248,113,113,0.35)' : 'rgba(34,197,94,0.35)'}`,
            }}
          >
            {error || successMsg}
          </div>
        )}

        {view === 'list' && (
          <div style={cardStyle}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                type="email"
                placeholder="Filter by your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
              />
              <button type="button" style={ghostBtn} onClick={() => void loadTickets()} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>

            {tickets.length === 0 && !loading ? (
              <div style={emptyState}>
                <h3 style={{ margin: '0 0 6px', fontFamily: '"Space Grotesk", sans-serif' }}>No tickets yet</h3>
                <p style={{ margin: '0 0 14px', color: '#B5B5C3' }}>Raise a request and track status here.</p>
                <button type="button" style={primaryBtn} onClick={() => setView('create')}>
                  Create your first ticket
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tickets.map((t) => (
                  <button key={t._id} type="button" onClick={() => void openTicket(t._id)} style={ticketRowStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{t.title}</div>
                        <div style={{ ...mono, opacity: 0.55, marginTop: 4 }}>{t.ticketNumber}</div>
                      </div>
                      <StatusPill status={t.status} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', fontSize: 12 }}>
                      <span style={chip}>{t.priority}</span>
                      {t.category ? <span style={chip}>{t.category.replace(/_/g, ' ')}</span> : null}
                      {t.attachments?.length ? <span style={chip}>{t.attachments.length} file(s)</span> : null}
                      <span style={{ opacity: 0.55, marginLeft: 'auto', color: '#B5B5C3' }}>
                        {new Date(t.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'create' && (
          <form onSubmit={onCreate} style={cardStyle}>
            <h2 style={{ margin: '0 0 4px', fontSize: 22, fontFamily: '"Space Grotesk", sans-serif' }}>
              New support request
            </h2>
            <p style={{ margin: '0 0 12px', color: '#B5B5C3', fontSize: 13 }}>
              Pick a category, describe the issue, and optionally attach screenshots or logs.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {categories.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    style={{
                      ...categoryCard,
                      borderColor: active ? 'rgba(216,27,96,.55)' : 'rgba(255,255,255,.1)',
                      background: active ? 'rgba(216,27,96,.14)' : 'rgba(255,255,255,.04)',
                      boxShadow: active ? '0 0 0 1px rgba(30,136,229,.35)' : 'none',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: '#B5B5C3', marginTop: 2 }}>{c.hint}</div>
                  </button>
                );
              })}
            </div>

            <label style={labelStyle}>
              Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                style={inputStyle}
              >
                {['critical', 'high', 'medium', 'low'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              Title
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Short summary of the issue"
                style={inputStyle}
                required
              />
            </label>

            <label style={labelStyle}>
              Details
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What happened? Steps to reproduce, expected vs actual…"
                style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
                required
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
              }}
              style={{
                ...dropZone,
                borderColor: dragOver ? 'rgba(30,136,229,.6)' : 'rgba(255,255,255,.14)',
                background: dragOver ? 'rgba(30,136,229,.12)' : 'rgba(255,255,255,.03)',
              }}
            >
              <div style={{ fontWeight: 650, marginBottom: 4 }}>Drop files here</div>
              <div style={{ fontSize: 12, color: '#B5B5C3', marginBottom: 10 }}>
                Max 5 files · 4MB each · images, logs, PDFs
              </div>
              <label style={{ ...ghostBtn, display: 'inline-block', cursor: 'pointer' }}>
                Browse files
                <input
                  hidden
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.target.files?.length) addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              {files.length > 0 && (
                <ul style={{ margin: '12px 0 0', paddingLeft: 0, listStyle: 'none', fontSize: 13, textAlign: 'left', color: '#CFCFD8' }}>
                  {files.map((f, i) => (
                    <li
                      key={f.name + f.size + i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        alignItems: 'center',
                        padding: '8px 10px',
                        marginBottom: 6,
                        borderRadius: 10,
                        background: 'rgba(0,0,0,.28)',
                      }}
                    >
                      <span>
                        {f.type.startsWith('image/') ? '🖼️ ' : '📎 '}
                        {f.name} ({formatBytes(f.size)})
                      </span>
                      <button type="button" onClick={() => removeFile(i)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: 12 }}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button type="submit" disabled={submitting} style={primaryBtn}>
              {submitting ? 'Submitting…' : 'Submit ticket'}
            </button>
          </form>
        )}

        {view === 'detail' && selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ ...mono, opacity: 0.55, marginBottom: 4 }}>{selected.ticketNumber}</div>
                  <h2 style={{ margin: 0, fontSize: 22, fontFamily: '"Space Grotesk", sans-serif' }}>
                    {selected.title}
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <StatusPill status={selected.status} />
                  <span style={chip}>{selected.priority}</span>
                </div>
              </div>
              <p style={{ whiteSpace: 'pre-wrap', marginTop: 16, lineHeight: 1.55, color: '#CFCFD8' }}>
                {selected.description}
              </p>
              <div style={{ fontSize: 13, color: '#999', marginTop: 8 }}>
                {selected.reporterName || selected.reporterEmail || 'Anonymous'} ·{' '}
                {new Date(selected.createdAt).toLocaleString()}
              </div>
            </div>

            {(selected.attachments?.length || 0) > 0 && (
              <div style={cardStyle}>
                <h3 style={{ marginTop: 0, fontFamily: '"Space Grotesk", sans-serif' }}>Attachments</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selected.attachments!.map((a, i) => {
                    const href = a.url || '';
                    const isImage =
                      (a.contentType || '').startsWith('image/') ||
                      /\.(png|jpe?g|gif|webp|svg)$/i.test(a.filename || '');
                    return (
                      <div key={`${a.filename}-${i}`} style={attachmentRow}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                          {isImage && href ? (
                            <a href={href} target="_blank" rel="noreferrer">
                              <img
                                src={href}
                                alt={a.filename}
                                loading="lazy"
                                decoding="async"
                                style={{
                                  width: 56,
                                  height: 56,
                                  objectFit: 'cover',
                                  borderRadius: 8,
                                  background: '#111',
                                }}
                              />
                            </a>
                          ) : (
                            <span style={{ fontSize: 22 }}>📎</span>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{a.filename}</div>
                            <div style={{ opacity: 0.65, fontSize: 12 }}>
                              {[a.contentType, formatBytes(a.size)].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </div>
                        {href ? (
                          <a href={href} target="_blank" rel="noreferrer" style={{ color: '#93C5FD', fontWeight: 600 }}>
                            Open
                          </a>
                        ) : (
                          <span style={{ opacity: 0.5, fontSize: 12 }}>Unavailable</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={cardStyle}>
              <h3 style={{ marginTop: 0, fontFamily: '"Space Grotesk", sans-serif' }}>Conversation</h3>
              {(selected.comments || []).length === 0 ? (
                <p style={{ color: '#B5B5C3' }}>No comments yet — add a follow-up below.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {(selected.comments || []).map((c, i) => (
                    <div key={i} style={commentBubble}>
                      <div style={{ fontSize: 12, fontWeight: 650, marginBottom: 4, color: '#F9A8D4' }}>
                        {c.authorName || c.authorId?.fullName || 'User'} ·{' '}
                        {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#E8E4DA' }}>{c.content}</div>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={onComment} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a follow-up comment"
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                />
                <button type="submit" disabled={submitting || !comment.trim()} style={primaryBtn}>
                  {submitting ? 'Sending…' : 'Post comment'}
                </button>
              </form>
            </div>
          </div>
        )}

        <div style={footer}>
          © {new Date().getFullYear()} {brandName} · Customer support
        </div>
      </div>
    </div>
  );
}

const pageShell: CSSProperties = {
  position: 'relative',
  minHeight: '100vh',
  width: '100vw',
  maxWidth: '100%',
  boxSizing: 'border-box',
  overflowX: 'hidden',
  overflowY: 'auto',
  padding: 'clamp(16px, 3vw, 32px) clamp(12px, 3vw, 28px) 56px',
  margin: 0,
  background: '#06060B',
  color: '#fff',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const bgLayer: CSSProperties = {
  position: 'fixed',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
  zIndex: 0,
};

const orb: CSSProperties = {
  position: 'absolute',
  borderRadius: '50%',
  filter: 'blur(100px)',
  opacity: 0.45,
};

const orbMagenta: CSSProperties = {
  width: 420,
  height: 420,
  background: '#D81B60',
  top: -120,
  left: -120,
};

const orbBlue: CSSProperties = {
  width: 380,
  height: 380,
  background: '#1E88E5',
  right: -120,
  top: 120,
};

const orbCyan: CSSProperties = {
  width: 280,
  height: 280,
  background: '#06B6D4',
  left: '45%',
  bottom: -80,
  opacity: 0.35,
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

const inner: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  maxWidth: 900,
  margin: '0 auto',
};

const heroBand: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
  padding: '24px 22px',
  borderRadius: 22,
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.08)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 20px 60px rgba(0,0,0,.35), 0 0 60px rgba(216,27,96,.1)',
  marginBottom: 18,
};

const logoImg: CSSProperties = {
  width: 64,
  height: 64,
  objectFit: 'contain',
  borderRadius: 16,
  background: '#fff',
  padding: 6,
  boxShadow: '0 0 28px rgba(30,136,229,.35)',
};

const logoFallback: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 4,
  padding: '10px 14px',
  borderRadius: 14,
  background: '#fff',
};

const logoFallbackText: CSSProperties = {
  fontFamily: '"Space Grotesk", sans-serif',
  fontWeight: 700,
  fontSize: 22,
  background: 'linear-gradient(180deg, #1E88E5 0%, #D81B60 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const eyebrow: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#F9A8D4',
  marginBottom: 6,
};

const heroTitle: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(26px, 4vw, 34px)',
  fontWeight: 750,
  letterSpacing: '-0.02em',
  fontFamily: '"Space Grotesk", sans-serif',
};

const gradientText: CSSProperties = {
  background: 'linear-gradient(90deg, #D81B60, #7C3AED, #1E88E5, #22D3EE)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const heroSub: CSSProperties = {
  margin: '8px 0 0',
  color: '#B5B5C3',
  fontSize: 14,
  maxWidth: 480,
  lineHeight: 1.5,
};

const cardStyle: CSSProperties = {
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 18,
  padding: 22,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  boxShadow: '0 12px 40px rgba(0,0,0,.25)',
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
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,.12)',
  fontSize: 14,
  fontWeight: 400,
  fontFamily: 'inherit',
  background: 'rgba(255,255,255,.06)',
  color: '#fff',
  colorScheme: 'dark',
};

const primaryBtn: CSSProperties = {
  padding: '11px 16px',
  borderRadius: 12,
  border: 'none',
  background: 'linear-gradient(135deg, #D81B60, #7C3AED, #1E88E5)',
  color: '#fff',
  fontWeight: 650,
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: '0 0 28px rgba(124,58,237,.35)',
};

const ghostBtn: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,.15)',
  background: 'rgba(255,255,255,.05)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const alertStyle: CSSProperties = {
  fontSize: 13,
  padding: '10px 12px',
  borderRadius: 10,
  marginBottom: 16,
};

const ticketRowStyle: CSSProperties = {
  textAlign: 'left',
  padding: 16,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,.1)',
  background: 'rgba(255,255,255,.04)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: '#fff',
};

const chip: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 999,
  background: 'rgba(255,255,255,.08)',
  border: '1px solid rgba(255,255,255,.1)',
  textTransform: 'capitalize',
  color: '#CFCFD8',
};

const mono: CSSProperties = {
  fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
  fontSize: 12,
};

const emptyState: CSSProperties = {
  textAlign: 'center',
  padding: '36px 16px',
};

const categoryCard: CSSProperties = {
  textAlign: 'left',
  padding: '12px 12px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,.1)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: '#fff',
};

const dropZone: CSSProperties = {
  border: '1.5px dashed rgba(255,255,255,.14)',
  borderRadius: 14,
  padding: 20,
  textAlign: 'center',
};

const attachmentRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 12px',
  borderRadius: 10,
  background: 'rgba(0,0,0,.28)',
  fontSize: 13,
};

const commentBubble: CSSProperties = {
  padding: 12,
  background: 'rgba(0,0,0,.28)',
  borderRadius: 12,
  borderLeft: '3px solid #D81B60',
};

const statsRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 12,
  marginBottom: 16,
};

const statCard: CSSProperties = {
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 14,
  padding: '14px 16px',
  backdropFilter: 'blur(12px)',
};

const statLabel: CSSProperties = {
  fontSize: 12,
  color: '#B5B5C3',
  fontWeight: 600,
};

const statValue: CSSProperties = {
  fontSize: 28,
  fontWeight: 750,
  marginTop: 4,
  fontFamily: '"Space Grotesk", sans-serif',
  background: 'linear-gradient(90deg, #D81B60, #1E88E5)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const footer: CSSProperties = {
  marginTop: 28,
  textAlign: 'center',
  color: '#777',
  fontSize: 13,
};
