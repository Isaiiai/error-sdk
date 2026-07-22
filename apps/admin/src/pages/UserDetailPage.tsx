import { useState } from 'react';
import { useNavigate, useParams, Navigate, Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  TextField,
  MenuItem,
  Alert,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Link,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { format } from 'date-fns';
import { usersApi } from '../api/client';
import { usePermissions, ROLE_LABELS } from '../rbac';
import { PageHeader } from '../components/PageHeader';

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can, user: me } = usePermissions();
  const [pwdOpen, setPwdOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: async () => (await usersApi.get(userId!)).data.data,
    enabled: !!userId && can('users:manage'),
  });

  const update = useMutation({
    mutationFn: (payload: Record<string, unknown>) => usersApi.update(userId!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', userId] });
      qc.invalidateQueries({ queryKey: ['users'] });
      setMessage('User updated');
      setError('');
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Update failed'
      );
    },
  });

  const resetPassword = useMutation({
    mutationFn: () => usersApi.resetPassword(userId!, password),
    onSuccess: () => {
      setPwdOpen(false);
      setPassword('');
      setMessage('Password reset');
      setError('');
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Password reset failed'
      );
    },
  });

  const remove = useMutation({
    mutationFn: (hard: boolean) => usersApi.remove(userId!, hard),
    onSuccess: (_res, hard) => {
      if (hard) navigate('/users');
      else {
        qc.invalidateQueries({ queryKey: ['user', userId] });
        qc.invalidateQueries({ queryKey: ['users'] });
        setMessage('User suspended');
      }
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Action failed'
      );
    },
  });

  if (!can('users:manage')) return <Navigate to="/" replace />;
  if (isLoading || !user) return <Typography>Loading…</Typography>;

  const isSelf = me?.id === user.id;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/users')} sx={{ mb: 2 }}>
        Back to users
      </Button>

      <PageHeader
        eyebrow="Manage"
        title={user.fullName}
        description={user.email}
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={ROLE_LABELS[user.role] || user.role} color="primary" />
            <Chip
              label={user.status}
              color={user.status === 'active' ? 'success' : user.status === 'suspended' ? 'error' : 'default'}
            />
          </Stack>
        }
      />

      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Profile</Typography>
            <TextField
              label="Full name"
              defaultValue={user.fullName}
              onBlur={(e) => {
                if (e.target.value !== user.fullName) update.mutate({ fullName: e.target.value });
              }}
            />
            <TextField
              label="Username"
              defaultValue={user.username || ''}
              onBlur={(e) => {
                if (e.target.value && e.target.value !== user.username) {
                  update.mutate({ username: e.target.value });
                }
              }}
            />
            <TextField
              select
              label="Role"
              value={user.role}
              disabled={isSelf}
              onChange={(e) => update.mutate({ role: e.target.value })}
              helperText={isSelf ? 'You cannot change your own role' : undefined}
            >
              <MenuItem value="developer">Developer</MenuItem>
              <MenuItem value="product_manager">Product Manager</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </TextField>
            <TextField
              select
              label="Status"
              value={user.status}
              disabled={isSelf}
              onChange={(e) => update.mutate({ status: e.target.value })}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
            </TextField>
            <Typography variant="body2" color="text.secondary">
              Last login:{' '}
              {user.lastLogin ? format(new Date(user.lastLogin), 'PPpp') : 'Never'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Created: {user.createdAt ? format(new Date(user.createdAt), 'PPpp') : '—'}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Permissions
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {(user.permissions || []).map((p: string) => (
                <Chip key={p} size="small" label={p} variant="outlined" sx={{ mb: 0.5 }} />
              ))}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Actions
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" onClick={() => setPwdOpen(true)}>
                Reset password
              </Button>
              {!isSelf && user.status !== 'suspended' && (
                <Button color="warning" onClick={() => remove.mutate(false)}>
                  Suspend
                </Button>
              )}
              {!isSelf && (
                <Button
                  color="error"
                  onClick={() => {
                    if (window.confirm(`Permanently delete ${user.email}?`)) remove.mutate(true);
                  }}
                >
                  Delete
                </Button>
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Assigned projects
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Project</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(user.assignedProjects || []).map(
                  (p: {
                    _id: string;
                    projectName: string;
                    projectSlug: string;
                    projectRole: string;
                    status: string;
                  }) => (
                    <TableRow key={p._id}>
                      <TableCell>
                        <Link component={RouterLink} to={`/projects/${p._id}`}>
                          {p.projectName}
                        </Link>
                        <Typography variant="caption" display="block" color="text.secondary">
                          {p.projectSlug}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{p.projectRole}</TableCell>
                      <TableCell>
                        <Chip size="small" label={p.status} />
                      </TableCell>
                    </TableRow>
                  )
                )}
                {!user.assignedProjects?.length && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography color="text.secondary">No project memberships</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Activity
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Action</TableCell>
                  <TableCell>Resource</TableCell>
                  <TableCell>When</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(user.activity || []).map(
                  (a: {
                    _id: string;
                    action: string;
                    resource: string;
                    resourceId?: string;
                    createdAt: string;
                  }) => (
                    <TableRow key={a._id}>
                      <TableCell>{a.action}</TableCell>
                      <TableCell>
                        {a.resource}
                        {a.resourceId ? (
                          <Typography variant="caption" display="block" color="text.secondary">
                            {a.resourceId}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {a.createdAt ? format(new Date(a.createdAt), 'MMM d, HH:mm') : '—'}
                      </TableCell>
                    </TableRow>
                  )
                )}
                {!user.activity?.length && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography color="text.secondary">No recent activity</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={pwdOpen} onClose={() => setPwdOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset password</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            type="password"
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helperText="Min 12 chars with upper, lower, number, special"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPwdOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!password || resetPassword.isPending}
            onClick={() => resetPassword.mutate()}
          >
            Save password
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
