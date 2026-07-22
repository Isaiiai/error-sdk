import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
  Grid,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { projectsApi } from '../api/client';
import { format } from 'date-fns';
import { usePermissions } from '../rbac';
import { PageHeader } from '../components/PageHeader';

interface CreateForm {
  projectName: string;
  description: string;
  githubUrl: string;
  repositoryBranch: string;
  stagingUrl: string;
  productionUrl: string;
  clientName: string;
  clientCompany: string;
  supportEmail: string;
  supportPhone: string;
  slaNotes: string;
  techStack: string;
  developerEmails: string;
  adminFullName: string;
  adminEmail: string;
  adminUsername: string;
  adminPassword: string;
  adminNotes: string;
}

const emptyForm: CreateForm = {
  projectName: '',
  description: '',
  githubUrl: '',
  repositoryBranch: 'main',
  stagingUrl: '',
  productionUrl: '',
  clientName: '',
  clientCompany: '',
  supportEmail: '',
  supportPhone: '',
  slaNotes: '',
  techStack: '',
  developerEmails: '',
  adminFullName: '',
  adminEmail: '',
  adminUsername: '',
  adminPassword: '',
  adminNotes: '',
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canCreate = can('projects:create');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [createdKeys, setCreatedKeys] = useState<{ key: string; secretKey: string } | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await projectsApi.list()).data.data.projects,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      projectsApi.create({
        projectName: form.projectName,
        description: form.description || undefined,
        githubUrl: form.githubUrl || undefined,
        repositoryBranch: form.repositoryBranch || undefined,
        stagingUrl: form.stagingUrl || undefined,
        productionUrl: form.productionUrl || undefined,
        clientName: form.clientName || undefined,
        clientCompany: form.clientCompany || undefined,
        supportEmail: form.supportEmail || undefined,
        supportPhone: form.supportPhone || undefined,
        slaNotes: form.slaNotes || undefined,
        techStack: form.techStack
          ? form.techStack.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        developerEmails: form.developerEmails
          ? form.developerEmails.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        clientAdmin:
          form.adminEmail || form.adminUsername || form.adminPassword
            ? {
                fullName: form.adminFullName || undefined,
                email: form.adminEmail || undefined,
                username: form.adminUsername || undefined,
                password: form.adminPassword || undefined,
                notes: form.adminNotes || undefined,
              }
            : undefined,
      }),
    onSuccess: (res) => {
      const keys = res.data.data.apiKeys?.[0];
      if (keys) setCreatedKeys({ key: keys.key, secretKey: keys.secretKey });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setForm(emptyForm);
    },
  });

  const set = (key: keyof CreateForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Box>
      <PageHeader
        eyebrow="Manage"
        title="Projects"
        description={
          canCreate
            ? 'Create projects with GitHub, developers, and client credentials'
            : 'Projects assigned to you — ask an admin or PM to create new ones'
        }
        actions={
          canCreate ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
              New project
            </Button>
          ) : undefined
        }
      />

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>GitHub</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Members</TableCell>
              <TableCell>Errors</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.map((p: {
              _id: string;
              projectName: string;
              clientName?: string;
              githubUrl?: string;
              role: string;
              members: number;
              errorCount: number;
              status: string;
              createdAt: string;
            }) => (
              <TableRow
                key={p._id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => {
                  localStorage.setItem('selectedProjectId', p._id);
                  navigate(`/projects/${p._id}`);
                }}
              >
                <TableCell sx={{ fontWeight: 600 }}>{p.projectName}</TableCell>
                <TableCell>{p.clientName || '—'}</TableCell>
                <TableCell sx={{ maxWidth: 180 }} >
                  <Typography variant="body2" noWrap fontFamily='"IBM Plex Mono", monospace'>
                    {p.githubUrl || '—'}
                  </Typography>
                </TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{p.role}</TableCell>
                <TableCell>{p.members}</TableCell>
                <TableCell>{p.errorCount}</TableCell>
                <TableCell>
                  <Chip size="small" label={p.status} color={p.status === 'active' ? 'success' : 'default'} />
                </TableCell>
                <TableCell>{format(new Date(p.createdAt), 'MMM d, yyyy')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog
        open={open}
        onClose={() => { setOpen(false); setCreatedKeys(null); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{createdKeys ? 'Project created' : 'Create project (Maintenance profile)'}</DialogTitle>
        <DialogContent>
          {createdKeys ? (
            <Box sx={{ pt: 1 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Save these keys now — the secret key will not be shown again.
              </Alert>
              <TextField label="Project Key" fullWidth value={createdKeys.key} InputProps={{ readOnly: true }} sx={{ mb: 2 }} />
              <TextField label="Secret Key" fullWidth value={createdKeys.secretKey} InputProps={{ readOnly: true }} />
            </Box>
          ) : (
            <Box sx={{ pt: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Basics</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField label="Project name" fullWidth required value={form.projectName} onChange={(e) => set('projectName', e.target.value)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Client name" fullWidth value={form.clientName} onChange={(e) => set('clientName', e.target.value)} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Repository & environments</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <TextField label="GitHub URL" fullWidth value={form.githubUrl} onChange={(e) => set('githubUrl', e.target.value)} placeholder="https://github.com/org/repo" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField label="Default branch" fullWidth value={form.repositoryBranch} onChange={(e) => set('repositoryBranch', e.target.value)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Staging URL" fullWidth value={form.stagingUrl} onChange={(e) => set('stagingUrl', e.target.value)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Production URL" fullWidth value={form.productionUrl} onChange={(e) => set('productionUrl', e.target.value)} />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Tech stack (comma-separated)"
                    fullWidth
                    value={form.techStack}
                    onChange={(e) => set('techStack', e.target.value)}
                    placeholder="React, Node, MongoDB"
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Developers & support</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Developer emails (comma-separated)"
                    fullWidth
                    value={form.developerEmails}
                    onChange={(e) => set('developerEmails', e.target.value)}
                    helperText="Existing users with these emails are auto-added as developers"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Support email" fullWidth value={form.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Support phone" fullWidth value={form.supportPhone} onChange={(e) => set('supportPhone', e.target.value)} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="SLA notes" fullWidth multiline rows={2} value={form.slaNotes} onChange={(e) => set('slaNotes', e.target.value)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Client company" fullWidth value={form.clientCompany} onChange={(e) => set('clientCompany', e.target.value)} />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Client admin credentials (encrypted at rest)</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField label="Admin full name" fullWidth value={form.adminFullName} onChange={(e) => set('adminFullName', e.target.value)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Admin email" fullWidth value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Admin username" fullWidth value={form.adminUsername} onChange={(e) => set('adminUsername', e.target.value)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField label="Admin password" type="password" fullWidth value={form.adminPassword} onChange={(e) => set('adminPassword', e.target.value)} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Credential notes" fullWidth value={form.adminNotes} onChange={(e) => set('adminNotes', e.target.value)} />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpen(false); setCreatedKeys(null); }}>
            {createdKeys ? 'Done' : 'Cancel'}
          </Button>
          {!createdKeys && (
            <Button
              variant="contained"
              disabled={!form.projectName || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
