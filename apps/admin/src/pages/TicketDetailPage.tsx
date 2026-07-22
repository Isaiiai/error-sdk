import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  Grid,
  TextField,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { projectsApi } from '../api/client';
import { format } from 'date-fns';

const priorityColor: Record<string, 'error' | 'warning' | 'info' | 'success'> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'success',
};

function formatBytes(n?: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToDataUrl(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
  return { filename: file.name, dataUrl };
}

export default function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [projectId, setProjectId] = useState(
    search.get('projectId') || localStorage.getItem('selectedProjectId') || ''
  );
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await projectsApi.list()).data.data.projects,
  });

  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0]._id);
  }, [projects, projectId]);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', projectId, ticketId],
    queryFn: async () => (await projectsApi.getTicket(projectId, ticketId!)).data.data,
    enabled: !!projectId && !!ticketId,
  });

  useEffect(() => {
    if (!ticket) return;
    setStatus(ticket.status);
    setPriority(ticket.priority);
    setCategory(ticket.category);
  }, [ticket]);

  const custom = (ticket?.customFields || {}) as {
    source?: string;
    pageUrl?: string;
    platform?: Record<string, unknown>;
  };

  const update = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      projectsApi.updateTicket(projectId, ticketId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', projectId, ticketId] }),
  });

  const addComment = useMutation({
    mutationFn: () => projectsApi.addComment(projectId, ticketId!, comment.trim()),
    onSuccess: () => {
      setComment('');
      qc.invalidateQueries({ queryKey: ['ticket', projectId, ticketId] });
    },
  });

  const addAttachment = useMutation({
    mutationFn: (file: File) =>
      fileToDataUrl(file).then((payload) =>
        projectsApi.addAttachment(projectId, ticketId!, payload)
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', projectId, ticketId] }),
  });

  const platformSummary = useMemo(() => {
    const p = custom.platform as
      | { browser?: { name?: string }; device?: { os?: string }; runtime?: string }
      | undefined;
    if (!p) return null;
    return [p.runtime, p.device?.os, p.browser?.name].filter(Boolean).join(' · ');
  }, [custom.platform]);

  if (isLoading || !ticket) {
    return <Typography>Loading ticket…</Typography>;
  }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/tickets')} sx={{ mb: 2 }}>
        Back to tickets
      </Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ fontFamily: '"IBM Plex Mono", monospace' }}>
            {ticket.ticketNumber}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            {ticket.title}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={ticket.status.replace(/_/g, ' ')} />
            <Chip size="small" label={ticket.priority} color={priorityColor[ticket.priority] || 'default'} />
            <Chip size="small" label={ticket.category} variant="outlined" />
            {ticket.tags?.includes('customer-support') && (
              <Chip size="small" label="Customer support" color="secondary" />
            )}
          </Stack>
        </Box>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Description
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>{ticket.description || '—'}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Reporter:{' '}
              <strong>
                {ticket.reporterName || ticket.createdBy?.fullName || 'Unknown'}
                {ticket.reporterEmail ? ` <${ticket.reporterEmail}>` : ''}
              </strong>
            </Typography>
            {custom.pageUrl && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Page:{' '}
                <a href={custom.pageUrl} target="_blank" rel="noreferrer">
                  {custom.pageUrl}
                </a>
              </Typography>
            )}
            {platformSummary && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Platform: {platformSummary}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Created {format(new Date(ticket.createdAt), 'PPpp')}
            </Typography>
          </Paper>

          <Paper sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Attachments
            </Typography>
            {(ticket.attachments || []).length === 0 ? (
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                No attachments yet.
              </Typography>
            ) : (
              <List dense sx={{ mb: 1 }}>
                {ticket.attachments.map(
                  (a: {
                    _id?: string;
                    filename: string;
                    url?: string;
                    contentType?: string;
                    size?: number;
                  }) => {
                    const href = a.url || '';
                    const isImage =
                      (a.contentType || '').startsWith('image/') ||
                      /\.(png|jpe?g|gif|webp)$/i.test(a.filename || '');
                    return (
                      <ListItem key={a._id || a.filename} disableGutters alignItems="flex-start">
                        {isImage && href ? (
                          <Box
                            component="a"
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            sx={{ mr: 1.5, mt: 0.5 }}
                          >
                            <Box
                              component="img"
                              src={href}
                              alt={a.filename}
                              sx={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 1 }}
                            />
                          </Box>
                        ) : null}
                        <ListItemText
                          primary={
                            href ? (
                              <a href={href} target="_blank" rel="noreferrer">
                                {a.filename}
                              </a>
                            ) : (
                              a.filename
                            )
                          }
                          secondary={[a.contentType, formatBytes(a.size)].filter(Boolean).join(' · ')}
                        />
                      </ListItem>
                    );
                  }
                )}
              </List>
            )}
            <Button component="label" startIcon={<AttachFileIcon />} variant="outlined" size="small">
              Attach file
              <input
                hidden
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) addAttachment.mutate(file);
                  e.target.value = '';
                }}
              />
            </Button>
            {addAttachment.isError && (
              <Typography color="error" variant="caption" display="block" sx={{ mt: 1 }}>
                {(addAttachment.error as Error)?.message || 'Upload failed'}
              </Typography>
            )}
          </Paper>

          <Paper sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Comments
            </Typography>
            <List>
              {(ticket.comments || []).map(
                (c: {
                  _id?: string;
                  content: string;
                  authorName?: string;
                  authorId?: { fullName?: string };
                  createdAt: string;
                }) => (
                  <ListItem key={c._id || c.createdAt} alignItems="flex-start" divider>
                    <ListItemText
                      primary={c.authorName || c.authorId?.fullName || 'User'}
                      secondary={
                        <>
                          <Typography component="span" variant="body2" color="text.primary" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                            {c.content}
                          </Typography>
                          {c.createdAt ? format(new Date(c.createdAt), 'PPpp') : ''}
                        </>
                      }
                    />
                  </ListItem>
                )
              )}
            </List>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Add comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              sx={{ mt: 1 }}
            />
            <Button
              sx={{ mt: 1 }}
              variant="contained"
              disabled={!comment.trim() || addComment.isPending}
              onClick={() => addComment.mutate()}
            >
              Post comment
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Manage
            </Typography>
            <Stack spacing={2}>
              <TextField
                select
                label="Status"
                size="small"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed'].map((s) => (
                  <MenuItem key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Priority"
                size="small"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {['critical', 'high', 'medium', 'low'].map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Category"
                size="small"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {['bug', 'feature_request', 'performance', 'security', 'other'].map((c) => (
                  <MenuItem key={c} value={c}>
                    {c.replace(/_/g, ' ')}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                disabled={update.isPending}
                onClick={() => update.mutate({ status, priority, category })}
              >
                Save changes
              </Button>
              <Typography variant="body2" color="text.secondary">
                Assignee: {ticket.assignedTo?.fullName || 'Unassigned'}
              </Typography>
            </Stack>
          </Paper>

          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Activity
            </Typography>
            <List dense>
              {(ticket.activityLog || [])
                .slice()
                .reverse()
                .map(
                  (
                    a: {
                      action: string;
                      timestamp: string;
                      changes?: { field?: string; oldValue?: string; newValue?: string };
                    },
                    i: number
                  ) => (
                    <ListItem key={`${a.action}-${a.timestamp}-${i}`} disableGutters>
                      <ListItemText
                        primary={a.action.replace(/_/g, ' ')}
                        secondary={
                          <>
                            {a.changes?.field
                              ? `${a.changes.field}: ${a.changes.oldValue || '—'} → ${a.changes.newValue || '—'}`
                              : null}
                            <br />
                            {a.timestamp ? format(new Date(a.timestamp), 'PPpp') : ''}
                          </>
                        }
                      />
                    </ListItem>
                  )
                )}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
