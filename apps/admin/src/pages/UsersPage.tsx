import { useMemo, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
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
  Checkbox,
  Alert,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { format } from 'date-fns';
import { usersApi } from '../api/client';
import { usePermissions, ROLE_LABELS } from '../rbac';
import { PageHeader } from '../components/PageHeader';

const statusColor: Record<string, 'success' | 'default' | 'error' | 'warning'> = {
  active: 'success',
  inactive: 'default',
  suspended: 'error',
};

const roleColor: Record<string, 'primary' | 'secondary' | 'default'> = {
  admin: 'primary',
  product_manager: 'secondary',
  developer: 'default',
};

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  username?: string;
  role: string;
  status: string;
  lastLogin?: string;
  createdAt: string;
}

export default function UsersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = usePermissions();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'developer',
    username: '',
  });
  const [error, setError] = useState('');

  const params = useMemo(
    () => ({
      search: search || undefined,
      role: role || undefined,
      status: status || undefined,
      limit: 50,
    }),
    [search, role, status]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['users', params],
    queryFn: async () => (await usersApi.list(params)).data.data,
    enabled: can('users:manage'),
  });

  const create = useMutation({
    mutationFn: () =>
      usersApi.create({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,
        username: form.username || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setCreateOpen(false);
      setForm({ fullName: '', email: '', password: '', role: 'developer', username: '' });
      setError('');
    },
    onError: (err: unknown) => {
      setError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to create user'
      );
    },
  });

  const bulkStatus = useMutation({
    mutationFn: (next: string) => usersApi.bulkStatus(selected, next),
    onSuccess: () => {
      setSelected([]);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  if (!can('users:manage')) {
    return <Navigate to="/" replace />;
  }

  const users: UserRow[] = data?.users || [];
  const allSelected = users.length > 0 && selected.length === users.length;

  const toggleAll = () => {
    setSelected(allSelected ? [] : users.map((u) => u.id));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Box>
      <PageHeader
        eyebrow="Manage"
        title="Users"
        description="Platform directory — roles, status, and access"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Invite user
          </Button>
        }
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
          <TextField
            size="small"
            label="Search"
            placeholder="Name, email, username"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220 }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Role</InputLabel>
            <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="product_manager">Product Manager</MenuItem>
              <MenuItem value="developer">Developer</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
            </Select>
          </FormControl>
          {selected.length > 0 && (
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => bulkStatus.mutate('active')}>
                Activate ({selected.length})
              </Button>
              <Button size="small" color="warning" onClick={() => bulkStatus.mutate('suspended')}>
                Suspend
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox checked={allSelected} indeterminate={selected.length > 0 && !allSelected} onChange={toggleAll} />
              </TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last login</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right"> </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} hover selected={selected.includes(u.id)}>
                <TableCell padding="checkbox">
                  <Checkbox checked={selected.includes(u.id)} onChange={() => toggleOne(u.id)} />
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  {u.fullName}
                  {u.username ? (
                    <Typography variant="caption" display="block" color="text.secondary">
                      @{u.username}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={ROLE_LABELS[u.role] || u.role}
                    color={roleColor[u.role] || 'default'}
                  />
                </TableCell>
                <TableCell>
                  <Chip size="small" label={u.status} color={statusColor[u.status] || 'default'} />
                </TableCell>
                <TableCell>
                  {u.lastLogin ? format(new Date(u.lastLogin), 'MMM d, yyyy HH:mm') : '—'}
                </TableCell>
                <TableCell>
                  {u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : '—'}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Open profile">
                    <IconButton size="small" onClick={() => navigate(`/users/${u.id}`)}>
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && !users.length && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    No users match these filters
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Invite user</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Full name"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <TextField
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <TextField
            label="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            helperText="Optional — auto-generated if empty"
          />
          <TextField
            select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <MenuItem value="developer">Developer</MenuItem>
            <MenuItem value="product_manager">Product Manager</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
          <TextField
            label="Temporary password"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            helperText="Min 12 chars with upper, lower, number, special"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.fullName || !form.email || !form.password || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Creating…' : 'Create user'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
