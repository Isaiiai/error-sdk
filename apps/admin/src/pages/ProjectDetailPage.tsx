import { useState } from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  TextField,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Switch,
  FormControlLabel,
  Autocomplete,
  IconButton,
  Link,
  MenuItem,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { projectsApi } from '../api/client';
import { format } from 'date-fns';
import { can as canPerm, usePermissions, ROLE_LABELS, type Permission } from '../rbac';
import { PageHeader } from '../components/PageHeader';

interface DirectoryUser {
  id: string;
  email: string;
  fullName: string;
  username?: string;
  role: string;
  status: string;
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { permissions: platformPerms, can: platformCan } = usePermissions();
  const [tab, setTab] = useState('Overview');
  const [keyName, setKeyName] = useState('');
  const [newKeys, setNewKeys] = useState<{ key: string; secretKey: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);
  const [memberRole, setMemberRole] = useState('developer');
  const [memberError, setMemberError] = useState('');

  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);

  const [tagName, setTagName] = useState('');
  const [selectedCommit, setSelectedCommit] = useState('');
  const [syncMessage, setSyncMessage] = useState('');

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => (await projectsApi.get(projectId!)).data.data,
    enabled: !!projectId,
  });

  const perms = (project?.myPermissions as string[] | undefined)?.length
    ? (project!.myPermissions as Permission[])
    : platformPerms;
  const canDo = (...needed: Permission[]) => canPerm(perms, ...needed);

  const { data: directoryUsers = [] } = useQuery({
    queryKey: ['member-candidates', projectId],
    queryFn: async () =>
      (await projectsApi.memberCandidates(projectId!)).data.data.users as DirectoryUser[],
    enabled: !!projectId && canDo('projects:members') && tab === 'Members',
  });

  const availableUsers = directoryUsers;

  const { data: versionsData, refetch: refetchVersions } = useQuery({
    queryKey: ['versions', projectId],
    queryFn: async () => (await projectsApi.listVersions(projectId!)).data.data.versions,
    enabled: !!projectId && canDo('versions:read'),
  });

  const { data: commitsData, refetch: refetchCommits } = useQuery({
    queryKey: ['git-commits', projectId],
    queryFn: async () => (await projectsApi.listGitCommits(projectId!, 15)).data.data,
    enabled: !!projectId && !!project?.maintenanceProfile?.githubUrl && tab === 'Versions',
    retry: false,
  });

  const createKey = useMutation({
    mutationFn: () => projectsApi.createApiKey(projectId!, keyName),
    onSuccess: (res) => {
      setNewKeys({ key: res.data.data.key, secretKey: res.data.data.secretKey });
      setKeyName('');
      qc.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  const addMember = useMutation({
    mutationFn: () =>
      projectsApi.addMember(projectId!, {
        userId: selectedUser!.id,
        role: memberRole,
      }),
    onSuccess: () => {
      setSelectedUser(null);
      setMemberRole('developer');
      setMemberError('');
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['member-candidates', projectId] });
    },
    onError: (err: unknown) => {
      setMemberError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to add member'
      );
    },
  });

  const updateMember = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      projectsApi.updateMember(projectId!, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(projectId!, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['member-candidates', projectId] });
    },
    onError: (err: unknown) => {
      setMemberError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to remove member'
      );
    },
  });

  const updateSettings = useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      projectsApi.update(projectId!, { settings: { ...project?.settings, ...settings } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const revealPassword = useMutation({
    mutationFn: () => projectsApi.revealClientAdminPassword(projectId!),
    onSuccess: (res) => setRevealedPassword(res.data.data.password),
  });

  const syncGit = useMutation({
    mutationFn: () =>
      projectsApi.syncGitVersions(projectId!, { includeCommits: true, includeTags: true, limit: 20 }),
    onSuccess: (res) => {
      setSyncMessage(
        `Synced ${res.data.data.added} new version(s) from ${res.data.data.repo}@${res.data.data.branch}`
      );
      refetchVersions();
      qc.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Git sync failed';
      setSyncMessage(msg);
    },
  });

  const tagCommit = useMutation({
    mutationFn: () =>
      projectsApi.createVersionFromCommit(projectId!, {
        commitRef: selectedCommit,
        version: tagName,
        tagName,
        createGitTag: true,
        status: 'released',
      }),
    onSuccess: () => {
      setTagName('');
      setSelectedCommit('');
      setSyncMessage('Git tag created and version recorded');
      refetchVersions();
      refetchCommits();
      qc.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to tag commit';
      setSyncMessage(msg);
    },
  });

  if (!project) return <Typography>Loading…</Typography>;

  const profile = project.maintenanceProfile || {};
  const versions = versionsData || project.versions || [];

  const visibleTabs = [
    'Overview',
    'Maintenance profile',
    ...(canDo('versions:read') ? ['Versions'] : []),
    ...(canDo('projects:api_keys') ? ['API Keys'] : []),
    'Members',
    ...(canDo('projects:settings') ? ['Settings'] : []),
  ];
  const safeTab = visibleTabs.includes(tab) ? tab : 'Overview';

  return (
    <Box>
      <PageHeader
        eyebrow="Manage"
        title={project.projectName}
        description={project.description || project.projectSlug}
      />

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={safeTab}
          onChange={(_, v) => setTab(v)}
        >
          {visibleTabs.map((label) => (
            <Tab key={label} value={label} label={label} />
          ))}
        </Tabs>
      </Paper>

      {safeTab === 'Overview' && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>Slug:</strong> {project.projectSlug}
          </Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>Status:</strong> {project.status}
          </Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>Client:</strong> {profile.clientName || '—'}
          </Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>GitHub:</strong>{' '}
            {profile.githubUrl ? (
              <a href={profile.githubUrl} target="_blank" rel="noreferrer">{profile.githubUrl}</a>
            ) : (
              '—'
            )}
          </Typography>
          <Typography variant="body1">
            <strong>Created:</strong> {format(new Date(project.createdAt), 'PPpp')}
          </Typography>
        </Paper>
      )}

      {safeTab === 'Maintenance profile' && (
        <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="h6">Maintenance profile</Typography>
          <Typography><strong>Company:</strong> {profile.clientCompany || '—'}</Typography>
          <Typography><strong>Staging:</strong> {profile.stagingUrl || '—'}</Typography>
          <Typography><strong>Production:</strong> {profile.productionUrl || '—'}</Typography>
          <Typography><strong>Branch:</strong> {profile.repositoryBranch || '—'}</Typography>
          <Typography><strong>Support:</strong> {profile.supportEmail || '—'} {profile.supportPhone || ''}</Typography>
          <Typography><strong>SLA:</strong> {profile.slaNotes || '—'}</Typography>
          <Typography><strong>Tech stack:</strong> {(profile.techStack || []).join(', ') || '—'}</Typography>
          <Typography><strong>Developer emails:</strong> {(profile.developerEmails || []).join(', ') || '—'}</Typography>
          <Typography variant="subtitle1" sx={{ mt: 2 }}>Client admin</Typography>
          <Typography><strong>Name:</strong> {profile.clientAdmin?.fullName || '—'}</Typography>
          <Typography><strong>Email:</strong> {profile.clientAdmin?.email || '—'}</Typography>
          <Typography><strong>Username:</strong> {profile.clientAdmin?.username || '—'}</Typography>
          <Typography>
            <strong>Password:</strong>{' '}
            {revealedPassword || profile.clientAdmin?.passwordMasked || (profile.clientAdmin?.hasPassword ? '••••••••' : '—')}
          </Typography>
          {profile.clientAdmin?.hasPassword && canDo('client_admin:reveal') && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => revealPassword.mutate()}
              disabled={revealPassword.isPending}
              sx={{ alignSelf: 'flex-start' }}
            >
              Reveal password
            </Button>
          )}
        </Paper>
      )}

      {safeTab === 'Versions' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="h6">Versions from Git</Typography>
                <Typography variant="body2" color="text.secondary">
                  Sync tags & commits from GitHub using the configured PAT
                </Typography>
              </Box>
              <Button
                variant="contained"
                disabled={!profile.githubUrl || syncGit.isPending || !canDo('versions:write')}
                onClick={() => {
                  setSyncMessage('');
                  syncGit.mutate();
                }}
              >
                {syncGit.isPending ? 'Syncing…' : 'Sync from GitHub'}
              </Button>
            </Box>
            {!profile.githubUrl && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Set a GitHub URL on this project before syncing versions.
              </Alert>
            )}
            {syncMessage && (
              <Alert severity={syncGit.isError || tagCommit.isError ? 'error' : 'success'} sx={{ mb: 2 }}>
                {syncMessage}
              </Alert>
            )}
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Version</TableCell>
                  <TableCell>Commit</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {versions.map((v: {
                  _id?: string;
                  version: string;
                  commitShortSha?: string;
                  commitSha?: string;
                  commitUrl?: string;
                  commitMessage?: string;
                  description?: string;
                  source?: string;
                  status: string;
                  releaseDate: string;
                  tagName?: string;
                }) => (
                  <TableRow key={v._id || `${v.version}-${v.commitSha}`}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {v.version}
                      {v.tagName && v.tagName !== v.version ? (
                        <Typography variant="caption" display="block" color="text.secondary">
                          tag: {v.tagName}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell sx={{ fontFamily: '"IBM Plex Mono", monospace' }}>
                      {v.commitUrl ? (
                        <a href={v.commitUrl} target="_blank" rel="noreferrer">
                          {v.commitShortSha || v.commitSha?.slice(0, 7) || '—'}
                        </a>
                      ) : (
                        v.commitShortSha || '—'
                      )}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 280 }}>
                      <Typography variant="body2" noWrap>
                        {v.commitMessage || v.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={v.source || 'manual'} />
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={v.status} color={v.status === 'released' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>
                      {v.releaseDate ? format(new Date(v.releaseDate), 'MMM d, yyyy HH:mm') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {!versions.length && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography color="text.secondary" sx={{ py: 2 }}>
                        No versions yet — sync from GitHub or tag a commit below.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          {canDo('versions:write') && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Tag a commit as version</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Creates a Git tag on GitHub and records it as a project version
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <TextField
                size="small"
                label="Tag / version name"
                placeholder="v1.2.0"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
              />
              <TextField
                select
                size="small"
                label="Commit"
                value={selectedCommit}
                onChange={(e) => setSelectedCommit(e.target.value)}
                sx={{ minWidth: 320 }}
                SelectProps={{ native: true }}
              >
                <option value="">Select commit</option>
                {(commitsData?.commits || []).map((c: { sha: string; shortSha: string; message: string }) => (
                  <option key={c.sha} value={c.sha}>
                    {c.shortSha} — {c.message.slice(0, 60)}
                  </option>
                ))}
              </TextField>
              <Button
                variant="outlined"
                disabled={!tagName || !selectedCommit || tagCommit.isPending}
                onClick={() => {
                  setSyncMessage('');
                  tagCommit.mutate();
                }}
              >
                {tagCommit.isPending ? 'Tagging…' : 'Create git tag'}
              </Button>
            </Box>
            {commitsData && (
              <Typography variant="caption" color="text.secondary">
                Showing commits from {commitsData.repo}@{commitsData.branch}
              </Typography>
            )}
          </Paper>
          )}
        </Box>
      )}

      {safeTab === 'API Keys' && (
        <Paper sx={{ p: 3 }}>
          {newKeys && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              New key created — copy the secret now.
              <Box sx={{ mt: 1, fontFamily: '"IBM Plex Mono", monospace', fontSize: 13 }}>
                Key: {newKeys.key}<br />
                Secret: {newKeys.secretKey}
              </Box>
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField size="small" label="Key name" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
            <Button variant="contained" disabled={!keyName} onClick={() => createKey.mutate()}>
              Generate key
            </Button>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Key</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(project.apiKeys || []).map((k: { _id: string; name: string; key: string; status: string; createdAt: string }) => (
                <TableRow key={k._id}>
                  <TableCell>{k.name}</TableCell>
                  <TableCell sx={{ fontFamily: '"IBM Plex Mono", monospace' }}>{k.key}</TableCell>
                  <TableCell><Chip size="small" label={k.status} /></TableCell>
                  <TableCell>{format(new Date(k.createdAt), 'MMM d, yyyy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {safeTab === 'Members' && (
        <Paper sx={{ p: 3 }}>
          {canDo('projects:members') ? (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Add people from the Users directory. Create accounts under Users first if needed.
                {platformCan('users:manage') && (
                  <>
                    {' '}
                    <Link component={RouterLink} to="/users">
                      Manage users
                    </Link>
                  </>
                )}
              </Typography>
              {memberError && (
                <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setMemberError('')}>
                  {memberError}
                </Alert>
              )}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <Autocomplete
                  sx={{ minWidth: 320, flex: 1 }}
                  size="small"
                  options={availableUsers}
                  value={selectedUser}
                  onChange={(_, v) => setSelectedUser(v)}
                  getOptionLabel={(o) => `${o.fullName} (${o.email})`}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {option.fullName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.email} · {ROLE_LABELS[option.role] || option.role}
                        </Typography>
                      </Box>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField {...params} label="Select user" placeholder="Search by name or email" />
                  )}
                  noOptionsText="No available users — invite them from Users first"
                />
                <TextField
                  select
                  size="small"
                  label="Project role"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value="developer">Developer</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="owner">Owner</MenuItem>
                </TextField>
                <Button
                  variant="contained"
                  disabled={!selectedUser || addMember.isPending}
                  onClick={() => addMember.mutate()}
                >
                  {addMember.isPending ? 'Adding…' : 'Add member'}
                </Button>
              </Box>
            </Box>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              Only Admins and Product Managers can add or remove members.
            </Alert>
          )}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Platform role</TableCell>
                <TableCell>Project role</TableCell>
                <TableCell>Joined</TableCell>
                {canDo('projects:members') && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {(project.members || []).map(
                (
                  m: {
                    userId:
                      | {
                          _id: string;
                          email: string;
                          fullName: string;
                          role?: string;
                        }
                      | string;
                    role: string;
                    joinedAt: string;
                  },
                  i: number
                ) => {
                  const uid = typeof m.userId === 'object' ? m.userId._id : m.userId;
                  const name =
                    typeof m.userId === 'object'
                      ? m.userId.fullName
                      : directoryUsers.find((u) => u.id === uid)?.fullName || uid;
                  const email = typeof m.userId === 'object' ? m.userId.email : '';
                  const platformRole =
                    typeof m.userId === 'object'
                      ? m.userId.role
                      : directoryUsers.find((u) => u.id === uid)?.role;
                  const isOwner =
                    (typeof project.ownerId === 'object'
                      ? project.ownerId._id
                      : project.ownerId) === uid;

                  return (
                    <TableRow key={uid || i}>
                      <TableCell>
                        {platformCan('users:manage') && uid ? (
                          <Link
                            component="button"
                            underline="hover"
                            onClick={() => navigate(`/users/${uid}`)}
                            sx={{ fontWeight: 600, textAlign: 'left' }}
                          >
                            {name}
                          </Link>
                        ) : (
                          <Typography fontWeight={600}>{name}</Typography>
                        )}
                        {email ? (
                          <Typography variant="caption" display="block" color="text.secondary">
                            {email}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {platformRole ? (
                          <Chip size="small" label={ROLE_LABELS[platformRole] || platformRole} />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {canDo('projects:members') && !isOwner ? (
                          <TextField
                            select
                            size="small"
                            value={m.role}
                            onChange={(e) =>
                              updateMember.mutate({ userId: uid, role: e.target.value })
                            }
                            sx={{ minWidth: 130 }}
                          >
                            <MenuItem value="developer">Developer</MenuItem>
                            <MenuItem value="manager">Manager</MenuItem>
                            <MenuItem value="owner">Owner</MenuItem>
                          </TextField>
                        ) : (
                          <Chip
                            size="small"
                            label={isOwner ? 'Owner' : m.role}
                            color={isOwner ? 'primary' : 'default'}
                            sx={{ textTransform: 'capitalize' }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {m.joinedAt ? format(new Date(m.joinedAt), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      {canDo('projects:members') && (
                        <TableCell align="right">
                          {!isOwner && (
                            <IconButton
                              size="small"
                              color="error"
                              aria-label="Remove member"
                              disabled={removeMember.isPending}
                              onClick={() => {
                                if (window.confirm(`Remove ${name} from this project?`)) {
                                  removeMember.mutate(uid);
                                }
                              }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                }
              )}
              {!project.members?.length && (
                <TableRow>
                  <TableCell colSpan={canDo('projects:members') ? 5 : 4}>
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      No members yet
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {safeTab === 'Settings' && (
        <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={!!project.settings?.enableErrorGrouping}
                onChange={(e) => updateSettings.mutate({ enableErrorGrouping: e.target.checked })}
              />
            }
            label="Enable error grouping"
          />
          <FormControlLabel
            control={
              <Switch
                checked={!!project.settings?.enableAutoTicketCreation}
                onChange={(e) => updateSettings.mutate({ enableAutoTicketCreation: e.target.checked })}
              />
            }
            label="Auto-create tickets from recurring errors"
          />
          <TextField
            label="Retention days"
            type="number"
            size="small"
            sx={{ maxWidth: 200 }}
            defaultValue={project.settings?.retentionDays || 90}
            onBlur={(e) => updateSettings.mutate({ retentionDays: parseInt(e.target.value, 10) })}
          />
        </Paper>
      )}
    </Box>
  );
}

