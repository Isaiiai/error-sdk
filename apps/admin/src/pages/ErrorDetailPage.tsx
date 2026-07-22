import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  ButtonGroup,
  Menu,
  MenuItem,
  ListItemIcon,
  Snackbar,
  Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useState } from 'react';
import { errorsApi } from '../api/client';
import { severityColor } from '../theme';
import { format } from 'date-fns';
import { openErrorWithLlm, type LlmProvider } from '../utils/openWithLlm';

export default function ErrorDetailPage() {
  const { errorId } = useParams<{ errorId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [llmAnchor, setLlmAnchor] = useState<null | HTMLElement>(null);
  const [toast, setToast] = useState('');

  const { data: error } = useQuery({
    queryKey: ['error', errorId],
    queryFn: async () => (await errorsApi.get(errorId!)).data.data,
    enabled: !!errorId,
  });

  const { data: similar } = useQuery({
    queryKey: ['similar', errorId],
    queryFn: async () => (await errorsApi.similar(errorId!)).data.data.similarErrors,
    enabled: !!errorId,
  });

  const resolve = useMutation({
    mutationFn: () =>
      errorsApi.update(errorId!, { isResolved: true, resolutionNotes: 'Resolved via admin panel' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['error', errorId] }),
  });

  const handleOpenWithLlm = (provider: LlmProvider) => {
    if (!error) return;
    setLlmAnchor(null);
    const result = openErrorWithLlm(error, provider);
    if (result === 'copied') {
      setToast('Prompt copied — paste into your LLM');
    } else {
      setToast(`Opened in ${provider === 'chatgpt' ? 'ChatGPT' : 'Claude'}`);
    }
  };

  if (!error) return <Typography>Loading…</Typography>;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/errors')} sx={{ mb: 2 }}>
        Back to errors
      </Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={error.severity} sx={{ bgcolor: severityColor[error.severity], color: '#fff' }} />
            <Chip size="small" label={error.environment} variant="outlined" />
            <Chip size="small" label={error.isResolved ? 'Resolved' : 'Open'} color={error.isResolved ? 'success' : 'warning'} />
          </Box>
          <Typography variant="h5" sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, wordBreak: 'break-word' }}>
            {error.errorType}: {error.message}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <ButtonGroup variant="contained" color="secondary">
            <Button
              startIcon={<AutoAwesomeIcon />}
              onClick={() => handleOpenWithLlm('chatgpt')}
            >
              Open with LLM
            </Button>
            <Button
              size="small"
              aria-label="More LLM options"
              onClick={(e) => setLlmAnchor(e.currentTarget)}
              sx={{ px: 1 }}
            >
              <ArrowDropDownIcon />
            </Button>
          </ButtonGroup>
          <Menu
            anchorEl={llmAnchor}
            open={!!llmAnchor}
            onClose={() => setLlmAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={() => handleOpenWithLlm('chatgpt')}>
              <ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon>
              Open in ChatGPT
            </MenuItem>
            <MenuItem onClick={() => handleOpenWithLlm('claude')}>
              <ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon>
              Open in Claude
            </MenuItem>
            <MenuItem onClick={() => handleOpenWithLlm('copy')}>
              <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
              Copy prompt
            </MenuItem>
          </Menu>
          {!error.isResolved && (
            <Button
              variant="outlined"
              startIcon={<CheckCircleIcon />}
              onClick={() => resolve.mutate()}
              disabled={resolve.isPending}
            >
              Mark resolved
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          {error.screenshot?.url || error.screenshot?.data ? (
            <Paper sx={{ p: 2.5, mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Screenshot</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                {error.screenshot.storage === 'spaces' ? 'Stored on DigitalOcean Spaces' : 'Inline storage'}
                {error.screenshot.width
                  ? ` · ${error.screenshot.width}×${error.screenshot.height}`
                  : ''}
                {error.screenshot.capturedAt
                  ? ` · ${format(new Date(error.screenshot.capturedAt), 'PPp')}`
                  : ''}
              </Typography>
              <Box
                component="a"
                href={error.screenshot.url || error.screenshot.data}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: 'block' }}
              >
                <Box
                  component="img"
                  src={error.screenshot.url || error.screenshot.data}
                  alt="Error screenshot"
                  sx={{
                    width: '100%',
                    maxHeight: 420,
                    objectFit: 'contain',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: '#1A1A1A',
                  }}
                />
              </Box>
            </Paper>
          ) : null}

          {error.platform && (
            <Paper sx={{ p: 2.5, mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Platform analysis</Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 2,
                  bgcolor: '#1A1A1A',
                  color: '#E8E4DA',
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: 12,
                  fontFamily: '"IBM Plex Mono", monospace',
                  maxHeight: 240,
                }}
              >
                {JSON.stringify(error.platform, null, 2)}
              </Box>
            </Paper>
          )}

          <Paper sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Stack trace</Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                bgcolor: '#1A1A1A',
                color: '#E8E4DA',
                borderRadius: 1,
                overflow: 'auto',
                fontSize: 12,
                fontFamily: '"IBM Plex Mono", monospace',
                maxHeight: 360,
              }}
            >
              {error.stackTrace || 'No stack trace'}
            </Box>
          </Paper>

          <Paper sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Network activity</Typography>
            <List dense>
              {(error.networkActivity || error.context?.customData?.networkActivity || []).map(
                (
                  n: {
                    timestamp?: string;
                    method: string;
                    url: string;
                    status?: number;
                    durationMs: number;
                    type?: string;
                    error?: string;
                  },
                  i: number
                ) => (
                  <ListItem key={i} divider alignItems="flex-start">
                    <ListItemText
                      primary={`${n.method} ${n.url}`}
                      secondary={
                        <>
                          {n.type || 'http'} · status {n.status ?? '—'} · {n.durationMs}ms
                          {n.error ? ` · ${n.error}` : ''}
                          {n.timestamp ? ` · ${format(new Date(n.timestamp), 'HH:mm:ss')}` : ''}
                        </>
                      }
                    />
                  </ListItem>
                )
              )}
              {!(error.networkActivity || error.context?.customData?.networkActivity)?.length && (
                <Typography color="text.secondary">No network requests recorded</Typography>
              )}
            </List>
          </Paper>

          <Paper sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Breadcrumbs</Typography>
            <List dense>
              {(error.breadcrumbs || []).map(
                (
                  b: {
                    timestamp: string;
                    category: string;
                    message: string;
                    level: string;
                    data?: Record<string, unknown>;
                  },
                  i: number
                ) => (
                <ListItem key={i} divider>
                  <ListItemText
                    primary={b.message}
                    secondary={
                      <>
                        {`${b.category} · ${b.level} · ${b.timestamp ? format(new Date(b.timestamp), 'HH:mm:ss') : ''}`}
                        {b.data ? (
                          <Box
                            component="pre"
                            sx={{
                              mt: 0.5,
                              mb: 0,
                              fontSize: 11,
                              whiteSpace: 'pre-wrap',
                              fontFamily: '"IBM Plex Mono", monospace',
                            }}
                          >
                            {JSON.stringify(b.data, null, 2)}
                          </Box>
                        ) : null}
                      </>
                    }
                  />
                </ListItem>
              ))}
              {!error.breadcrumbs?.length && (
                <Typography color="text.secondary">No breadcrumbs</Typography>
              )}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Details</Typography>
            <Detail label="Occurrences" value={error.occurrenceCount} />
            <Detail label="Affected users" value={error.affectedUsers} />
            <Detail label="Version" value={error.version || '—'} />
            <Detail label="URL" value={error.url || '—'} />
            <Detail label="Browser" value={error.browser ? `${error.browser.name} ${error.browser.version}` : '—'} />
            <Detail label="Device" value={error.device ? `${error.device.type} / ${error.device.os}` : '—'} />
            <Detail label="First seen" value={error.firstOccurrence ? format(new Date(error.firstOccurrence), 'PPp') : '—'} />
            <Detail label="Last seen" value={error.lastOccurrence ? format(new Date(error.lastOccurrence), 'PPp') : '—'} />
            <Detail label="Fingerprint" value={error.fingerprint} mono />
          </Paper>

          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Similar errors</Typography>
            {(similar || []).map((s: { _id: string; message: string; occurrenceCount: number; similarity: number }) => (
              <Box
                key={s._id}
                sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider', cursor: 'pointer' }}
                onClick={() => navigate(`/errors/${s._id}`)}
              >
                <Typography variant="body2" noWrap fontFamily='"IBM Plex Mono", monospace'>
                  {s.message}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {s.occurrenceCount}× · {(s.similarity * 100).toFixed(0)}% similar
                </Typography>
              </Box>
            ))}
            {!similar?.length && <Typography color="text.secondary">None found</Typography>}
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={!!toast}
        autoHideDuration={2800}
        onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setToast('')} variant="filled" sx={{ borderRadius: 2 }}>
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function Detail({ label, value, mono }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography
        variant="body2"
        sx={{ fontFamily: mono ? '"IBM Plex Mono", monospace' : undefined, wordBreak: 'break-all' }}
      >
        {String(value)}
      </Typography>
      <Divider sx={{ mt: 1 }} />
    </Box>
  );
}
