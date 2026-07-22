import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { errorsApi, projectsApi } from '../api/client';
import { severityColor } from '../theme';
import { formatDistanceToNow } from 'date-fns';
import { PageHeader } from '../components/PageHeader';

export default function ErrorsPage() {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState(localStorage.getItem('selectedProjectId') || '');
  const [severity, setSeverity] = useState('');
  const [environment, setEnvironment] = useState('');
  const [search, setSearch] = useState('');
  const [isResolved, setIsResolved] = useState('false');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await projectsApi.list()).data.data.projects,
  });

  useEffect(() => {
    if (projects.length && !projectId) {
      setProjectId(projects[0]._id);
    }
  }, [projects, projectId]);

  const { data } = useQuery({
    queryKey: ['errors', projectId, severity, environment, search, isResolved],
    queryFn: async () =>
      (
        await errorsApi.list({
          projectId,
          severity: severity || undefined,
          environment: environment || undefined,
          search: search || undefined,
          isResolved,
          limit: 50,
        })
      ).data.data,
    enabled: !!projectId,
  });

  return (
    <Box>
      <PageHeader
        eyebrow="Monitor"
        title="Errors"
        description="Browse and triage captured error groups"
      />

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Project</InputLabel>
          <Select label="Project" value={projectId} onChange={(e) => { setProjectId(e.target.value); localStorage.setItem('selectedProjectId', e.target.value); }}>
            {projects.map((p: { _id: string; projectName: string }) => (
              <MenuItem key={p._id} value={p._id}>{p.projectName}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Severity</InputLabel>
          <Select label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {['critical', 'high', 'medium', 'low', 'info'].map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Environment</InputLabel>
          <Select label="Environment" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {['production', 'staging', 'development'].map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={isResolved} onChange={(e) => setIsResolved(e.target.value)}>
            <MenuItem value="false">Open</MenuItem>
            <MenuItem value="true">Resolved</MenuItem>
            <MenuItem value="">All</MenuItem>
          </Select>
        </FormControl>
        <TextField size="small" label="Search" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 200 }} />
      </Paper>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Message</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Env</TableCell>
              <TableCell>Count</TableCell>
              <TableCell>Users</TableCell>
              <TableCell>Last seen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.errors || []).map((err: {
              _id: string;
              message: string;
              severity: string;
              environment: string;
              occurrenceCount: number;
              affectedUsers: number;
              lastOccurrence: string;
            }) => (
              <TableRow key={err._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/errors/${err._id}`)}>
                <TableCell sx={{ maxWidth: 420, fontFamily: '"IBM Plex Mono", monospace', fontSize: 13 }}>
                  {err.message}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={err.severity} sx={{ bgcolor: severityColor[err.severity], color: '#fff' }} />
                </TableCell>
                <TableCell>{err.environment}</TableCell>
                <TableCell>{err.occurrenceCount}</TableCell>
                <TableCell>{err.affectedUsers}</TableCell>
                <TableCell>
                  {err.lastOccurrence
                    ? formatDistanceToNow(new Date(err.lastOccurrence), { addSuffix: true })
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
