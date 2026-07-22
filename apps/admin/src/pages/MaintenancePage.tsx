import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Stack,
  Switch,
  FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import { projectsApi } from '../api/client';
import { format, addHours } from 'date-fns';
import { usePermissions } from '../rbac';
import { PageHeader } from '../components/PageHeader';

export default function MaintenancePage() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('maintenance:write');
  const [projectId, setProjectId] = useState(localStorage.getItem('selectedProjectId') || '');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    severity: 'medium',
    status: 'scheduled' as 'scheduled' | 'ongoing',
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await projectsApi.list()).data.data.projects,
  });

  useEffect(() => {
    if (projects.length && !projectId) setProjectId(projects[0]._id);
  }, [projects, projectId]);

  const { data } = useQuery({
    queryKey: ['maintenance', projectId],
    queryFn: async () => (await projectsApi.listMaintenance(projectId)).data.data.maintenance,
    enabled: !!projectId,
  });

  const create = useMutation({
    mutationFn: () => {
      const toIso = (local: string) => {
        // datetime-local → ISO so SDK maintenance windows activate correctly
        const d = new Date(local);
        return Number.isNaN(d.getTime()) ? local : d.toISOString();
      };
      return projectsApi.createMaintenance(projectId, {
        ...form,
        startTime: toIso(form.startTime),
        endTime: toIso(form.endTime),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance', projectId] });
      setOpen(false);
      setForm({
        title: '',
        description: '',
        startTime: '',
        endTime: '',
        severity: 'medium',
        status: 'scheduled',
      });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      projectsApi.updateMaintenance(projectId, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance', projectId] }),
  });

  const startNow = () => {
    const start = new Date();
    const end = addHours(start, 2);
    const toLocal = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setForm({
      title: 'Emergency maintenance',
      description: 'Service temporarily unavailable while we perform maintenance.',
      startTime: toLocal(start),
      endTime: toLocal(end),
      severity: 'high',
      status: 'ongoing',
    });
    setOpen(true);
  };

  return (
    <Box>
      <PageHeader
        eyebrow="Manage"
        title="Maintenance"
        description={
          canWrite
            ? 'Toggle maintenance mode — the SDK shows a maintenance page while active'
            : 'View scheduled maintenance windows (read-only for developers)'
        }
        actions={
          canWrite ? (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<PlayArrowIcon />} onClick={startNow}>
                Start now
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
                Schedule
              </Button>
            </Stack>
          ) : undefined
        }
      />

      <FormControl size="small" sx={{ mb: 2, minWidth: 200 }}>
        <InputLabel>Project</InputLabel>
        <Select
          label="Project"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            localStorage.setItem('selectedProjectId', e.target.value);
          }}
        >
          {projects.map((p: { _id: string; projectName: string }) => (
            <MenuItem key={p._id} value={p._id}>{p.projectName}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Window</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>SDK page</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data || []).map((m: {
              _id: string;
              title: string;
              description?: string;
              startTime: string;
              endTime: string;
              severity: string;
              status: string;
              suppressErrors?: boolean;
            }) => {
              const now = Date.now();
              const live =
                m.status !== 'completed' &&
                new Date(m.startTime).getTime() <= now &&
                new Date(m.endTime).getTime() >= now;
              return (
                <TableRow key={m._id}>
                  <TableCell sx={{ fontWeight: 500 }}>
                    {m.title}
                    {m.description ? (
                      <Typography variant="caption" display="block" color="text.secondary" noWrap sx={{ maxWidth: 280 }}>
                        {m.description}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {format(new Date(m.startTime), 'PPp')}
                    <Typography variant="caption" display="block" color="text.secondary">
                      → {format(new Date(m.endTime), 'PPp')}
                    </Typography>
                  </TableCell>
                  <TableCell><Chip size="small" label={m.severity} /></TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={m.status.replace(/_/g, ' ')}
                      color={m.status === 'ongoing' || live ? 'warning' : m.status === 'completed' ? 'default' : 'info'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={live ? 'Visible to users' : 'Hidden'}
                      color={live ? 'error' : 'default'}
                      variant={live ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {canWrite ? (
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {m.status !== 'ongoing' && m.status !== 'completed' && (
                          <Button
                            size="small"
                            startIcon={<PlayArrowIcon />}
                            onClick={() =>
                              update.mutate({
                                id: m._id,
                                payload: {
                                  status: 'ongoing',
                                  startTime: new Date().toISOString(),
                                },
                              })
                            }
                          >
                            Activate
                          </Button>
                        )}
                        {m.status === 'ongoing' && (
                          <Button
                            size="small"
                            color="inherit"
                            startIcon={<StopIcon />}
                            onClick={() =>
                              update.mutate({
                                id: m._id,
                                payload: {
                                  status: 'completed',
                                  endTime: new Date().toISOString(),
                                },
                              })
                            }
                          >
                            End
                          </Button>
                        )}
                        {m.status === 'completed' && (
                          <Button
                            size="small"
                            onClick={() =>
                              update.mutate({
                                id: m._id,
                                payload: {
                                  status: 'ongoing',
                                  startTime: new Date().toISOString(),
                                  endTime: addHours(new Date(), 2).toISOString(),
                                },
                              })
                            }
                          >
                            Re-open
                          </Button>
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!data?.length && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No maintenance windows — use Start now to show the SDK maintenance page immediately
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {form.status === 'ongoing' ? 'Start maintenance now' : 'Schedule maintenance'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <TextField
            label="Description (shown on SDK page)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            multiline
            rows={2}
          />
          <TextField
            label="Start"
            type="datetime-local"
            InputLabelProps={{ shrink: true }}
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          />
          <TextField
            label="End"
            type="datetime-local"
            InputLabelProps={{ shrink: true }}
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          />
          <TextField
            select
            label="Severity"
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}
          >
            {['critical', 'high', 'medium', 'low'].map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={form.status === 'ongoing'}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.checked ? 'ongoing' : 'scheduled' })
                }
              />
            }
            label="Activate immediately (show SDK maintenance page)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.title || !form.startTime || !form.endTime || create.isPending}
            onClick={() => create.mutate()}
          >
            {form.status === 'ongoing' ? 'Start maintenance' : 'Schedule'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
