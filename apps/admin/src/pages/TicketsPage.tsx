import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { projectsApi } from '../api/client';
import { format } from 'date-fns';
import { PageHeader } from '../components/PageHeader';

const priorityColor: Record<string, 'error' | 'warning' | 'info' | 'success'> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'success',
};

export default function TicketsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState(localStorage.getItem('selectedProjectId') || '');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await projectsApi.list()).data.data.projects,
  });

  useEffect(() => {
    if (projects.length && !projectId) setProjectId(projects[0]._id);
  }, [projects, projectId]);

  const { data } = useQuery({
    queryKey: ['tickets', projectId],
    queryFn: async () => (await projectsApi.listTickets(projectId)).data.data,
    enabled: !!projectId,
  });

  const create = useMutation({
    mutationFn: () =>
      projectsApi.createTicket(projectId, { title, description, priority, category: 'bug' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', projectId] });
      setOpen(false);
      setTitle('');
      setDescription('');
    },
  });

  return (
    <Box>
      <PageHeader
        eyebrow="Monitor"
        title="Tickets"
        description="Track customer support and internal incidents"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            New ticket
          </Button>
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
              <TableCell>Ticket</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Assignee</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Open</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.tickets || []).map((t: {
              _id: string;
              ticketNumber: string;
              title: string;
              priority: string;
              status: string;
              tags?: string[];
              attachments?: unknown[];
              reporterName?: string;
              assignedTo?: { fullName: string };
              createdAt: string;
            }) => (
              <TableRow
                key={t._id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/tickets/${t._id}?projectId=${projectId}`)}
              >
                <TableCell sx={{ fontFamily: '"IBM Plex Mono", monospace' }}>{t.ticketNumber}</TableCell>
                <TableCell sx={{ fontWeight: 500 }}>
                  {t.title}
                  {(t.attachments?.length || 0) > 0 ? (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t.attachments!.length} attachment(s)
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>
                  {t.tags?.includes('customer-support') ? (
                    <Chip size="small" label={t.reporterName || 'Support'} color="secondary" />
                  ) : (
                    <Chip size="small" label="Internal" variant="outlined" />
                  )}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={t.priority} color={priorityColor[t.priority] || 'default'} />
                </TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{t.status.replace('_', ' ')}</TableCell>
                <TableCell>{t.assignedTo?.fullName || 'Unassigned'}</TableCell>
                <TableCell>{format(new Date(t.createdAt), 'MMM d, yyyy')}</TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <IconButton
                    size="small"
                    onClick={() => navigate(`/tickets/${t._id}?projectId=${projectId}`)}
                    aria-label="Open ticket"
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create ticket</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline rows={3} fullWidth />
          <TextField select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {['critical', 'high', 'medium', 'low'].map((p) => (
              <MenuItem key={p} value={p}>{p}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!title || create.isPending} onClick={() => create.mutate()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
