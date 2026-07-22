import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { projectsApi } from '../api/client';
import { severityColor, chartColors, brand } from '../theme';
import { usePermissions } from '../rbac';
import { formatDistanceToNow } from 'date-fns';
import { PageHeader } from '../components/PageHeader';
import { MetricTile } from '../components/MetricTile';

interface OverviewProject {
  _id: string;
  projectName: string;
  projectSlug: string;
  status: string;
  members: number;
  openErrors: number;
  errorsToday: number;
  criticalToday: number;
  openTickets: number;
  maintenanceActive: boolean;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const fullAnalytics = can('analytics:full');
  const [projectId, setProjectId] = useState('all');

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['projects-overview'],
    queryFn: async () => (await projectsApi.overview()).data.data,
  });

  const selectedProjectId = projectId !== 'all' ? projectId : '';

  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', selectedProjectId],
    queryFn: async () => (await projectsApi.dashboard(selectedProjectId)).data.data,
    enabled: !!selectedProjectId,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', selectedProjectId],
    queryFn: async () => (await projectsApi.analytics(selectedProjectId)).data.data,
    enabled: !!selectedProjectId && can('analytics:read'),
  });

  const isAll = projectId === 'all';
  const isLoading = overviewLoading || (!isAll && (dashLoading || analyticsLoading));
  const totals = overview?.totals;
  const projects: OverviewProject[] = overview?.projects || [];

  const allMetrics = [
    { label: 'Projects', value: totals?.projects ?? '—', hint: `${totals?.activeProjects ?? 0} active` },
    { label: 'Open Errors', value: totals?.openErrors ?? '—', hint: 'All projects' },
    { label: 'Errors (24h)', value: totals?.errorsToday ?? '—', hint: 'Last day' },
    { label: 'Critical (24h)', value: totals?.criticalToday ?? '—', hint: 'Severity' },
    { label: 'Open Tickets', value: totals?.openTickets ?? '—', hint: 'Active' },
    {
      label: 'Errors (30d)',
      value: totals?.totalErrors30d ?? '—',
      hint: 'Occurrences',
    },
    {
      label: 'Unique (30d)',
      value: totals?.uniqueErrors30d ?? '—',
      hint: 'Distinct',
    },
    {
      label: 'Resolution Rate',
      value:
        totals?.resolutionRate != null
          ? `${(totals.resolutionRate * 100).toFixed(0)}%`
          : '—',
      hint: 'Last 30 days',
    },
  ];

  if (fullAnalytics) {
    allMetrics.push(
      { label: 'Page Views (30d)', value: totals?.pageViews30d ?? '—', hint: 'Engagement' },
      { label: 'Sessions (30d)', value: totals?.sessions30d ?? '—', hint: 'Unique' },
      {
        label: 'Maintenance Live',
        value: totals?.maintenanceActive ?? '—',
        hint: 'Projects in maintenance',
      },
      {
        label: 'Resolved (30d)',
        value: totals?.resolvedErrors30d ?? '—',
        hint: 'Closed groups',
      }
    );
  }

  const singleSummary = analytics?.summary;
  const singleMetrics = [
    { label: 'Open Errors', value: dash?.openErrors ?? '—', hint: 'Unresolved' },
    { label: 'Errors (24h)', value: dash?.totalToday ?? '—', hint: 'Last day' },
    { label: 'Critical (24h)', value: dash?.criticalToday ?? '—', hint: 'Severity' },
    { label: 'Open Tickets', value: dash?.openTickets ?? '—', hint: 'Active' },
    { label: 'Total Errors', value: singleSummary?.totalErrors ?? '—', hint: 'Period' },
    { label: 'Unique Errors', value: singleSummary?.uniqueErrors ?? '—', hint: 'Groups' },
    { label: 'Resolved', value: singleSummary?.resolvedErrors ?? '—', hint: 'Closed' },
    {
      label: 'Resolution Rate',
      value:
        singleSummary?.resolutionRate != null
          ? `${(singleSummary.resolutionRate * 100).toFixed(0)}%`
          : '—',
      hint: 'Unique errors',
    },
  ];

  const metrics = isAll ? allMetrics : singleMetrics;
  const timeline = isAll ? overview?.timeline || [] : analytics?.timeline || [];
  const severityData = isAll
    ? (overview?.bySeverity || []).map((s: { name: string; count: number }) => ({
        name: String(s.name).charAt(0).toUpperCase() + String(s.name).slice(1),
        count: s.count,
      }))
    : singleSummary
      ? [
          { name: 'Critical', count: singleSummary.criticalErrors || 0 },
          { name: 'High', count: singleSummary.highErrors || 0 },
          { name: 'Medium', count: singleSummary.mediumErrors || 0 },
          { name: 'Low', count: singleSummary.lowErrors || 0 },
          { name: 'Info', count: singleSummary.infoErrors || 0 },
        ]
      : [];

  const metricAccents = [brand.magenta, brand.cobalt, brand.teal, '#D97706'];

  return (
    <Box>
      <PageHeader
        eyebrow="Monitor"
        title="Dashboard"
        description={
          isAll
            ? 'Live overview across every project you can access'
            : 'Metrics and recent errors for the selected project'
        }
        actions={
          <>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Scope</InputLabel>
              <Select
                label="Scope"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  if (e.target.value !== 'all') {
                    localStorage.setItem('selectedProjectId', e.target.value);
                  }
                }}
              >
                <MenuItem value="all">All projects</MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p._id} value={p._id}>
                    {p.projectName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {can('analytics:read') && !isAll && (
              <Button variant="outlined" onClick={() => navigate('/analytics')}>
                Full analytics
              </Button>
            )}
          </>
        }
      />

      {isLoading ? (
        <CircularProgress />
      ) : (
        <>
          <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 1.25 }}>
            {isAll ? 'All projects' : 'Project metrics'}
          </Typography>
          <Grid container spacing={1.75} sx={{ mb: 3 }}>
            {metrics.map((m, i) => (
              <Grid item xs={12} sm={6} md={3} key={m.label}>
                <MetricTile
                  label={m.label}
                  value={m.value}
                  hint={m.hint}
                  accent={metricAccents[i % metricAccents.length]}
                />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2.5, height: 320 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Errors over time {isAll ? '(all projects)' : ''}
                </Typography>
                <ResponsiveContainer width="100%" height="85%">
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: chartColors.axis }} />
                    <YAxis tick={{ fontSize: 12, fill: chartColors.axis }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={chartColors.primary}
                      strokeWidth={2.5}
                      dot={false}
                      name="Errors"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2.5, height: 320 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  By severity
                </Typography>
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart data={severityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartColors.axis }} />
                    <YAxis tick={{ fontSize: 12, fill: chartColors.axis }} />
                    <Tooltip />
                    <Bar dataKey="count" fill={chartColors.secondary} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          {isAll && (
            <Paper sx={{ mb: 3 }}>
              <Box sx={{ p: 2.5, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Projects</Typography>
                <Button size="small" onClick={() => navigate('/projects')}>
                  Manage projects
                </Button>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Project</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Open errors</TableCell>
                    <TableCell align="right">Today</TableCell>
                    <TableCell align="right">Critical</TableCell>
                    <TableCell align="right">Tickets</TableCell>
                    <TableCell align="right">Members</TableCell>
                    <TableCell>Maintenance</TableCell>
                    <TableCell align="right"> </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p._id} hover>
                      <TableCell>
                        <Typography fontWeight={600}>{p.projectName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.projectSlug}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={p.status} color={p.status === 'active' ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell align="right">{p.openErrors}</TableCell>
                      <TableCell align="right">{p.errorsToday}</TableCell>
                      <TableCell align="right">
                        <Typography color={p.criticalToday ? 'error.main' : 'text.primary'} fontWeight={p.criticalToday ? 700 : 400}>
                          {p.criticalToday}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{p.openTickets}</TableCell>
                      <TableCell align="right">{p.members}</TableCell>
                      <TableCell>
                        {p.maintenanceActive ? (
                          <Chip size="small" color="warning" label="Live" />
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => setProjectId(p._id)}>
                          View
                        </Button>
                        <Button size="small" onClick={() => navigate(`/projects/${p._id}`)}>
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!projects.length && (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                          No projects yet — create one to start tracking.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}

          {!isAll && (
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Recent Errors
              </Typography>
              <List>
                {(dash?.recentErrors || []).map(
                  (err: {
                    _id: string;
                    message: string;
                    severity: string;
                    environment: string;
                    occurrenceCount: number;
                    createdAt: string;
                  }) => (
                    <ListItem
                      key={err._id}
                      divider
                      sx={{ px: 0, cursor: 'pointer' }}
                      onClick={() => navigate(`/errors/${err._id}`)}
                    >
                      <ListItemText
                        primary={err.message}
                        secondary={`${err.environment} · ${err.occurrenceCount}× · ${formatDistanceToNow(new Date(err.createdAt), { addSuffix: true })}`}
                        primaryTypographyProps={{
                          fontFamily: '"IBM Plex Mono", monospace',
                          fontSize: 14,
                          noWrap: true,
                        }}
                      />
                      <Chip
                        size="small"
                        label={err.severity}
                        sx={{
                          bgcolor: severityColor[err.severity] || '#999',
                          color: '#fff',
                          ml: 1,
                        }}
                      />
                    </ListItem>
                  )
                )}
                {!dash?.recentErrors?.length && (
                  <Typography color="text.secondary">
                    No errors yet — integrate the SDK to start capturing.
                  </Typography>
                )}
              </List>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
