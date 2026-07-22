import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
} from '@mui/material';
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { projectsApi } from '../api/client';
import { usePermissions } from '../rbac';
import { chartColors } from '../theme';
import { PageHeader } from '../components/PageHeader';

const PLATFORM_COLORS: Record<string, string> = {
  mobile: chartColors.primary,
  tablet: '#F97316',
  desktop: chartColors.secondary,
  webview: chartColors.tertiary,
  unknown: '#94A3B8',
};

export default function AnalyticsPage() {
  const [projectId, setProjectId] = useState(localStorage.getItem('selectedProjectId') || '');
  const { can } = usePermissions();
  const fullAnalytics = can('analytics:full');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await projectsApi.list()).data.data.projects,
  });

  useEffect(() => {
    if (projects.length && !projectId) setProjectId(projects[0]._id);
  }, [projects, projectId]);

  const { data } = useQuery({
    queryKey: ['analytics', projectId],
    queryFn: async () => (await projectsApi.analytics(projectId)).data.data,
    enabled: !!projectId,
  });

  const severityData = data
    ? [
        { name: 'Critical', count: data.summary.criticalErrors },
        { name: 'High', count: data.summary.highErrors },
        { name: 'Medium', count: data.summary.mediumErrors },
        { name: 'Low', count: data.summary.lowErrors },
        { name: 'Info', count: data.summary.infoErrors },
      ]
    : [];

  const engagement = data?.engagement;
  const platformData = (engagement?.byPlatform || []).map(
    (p: { platform: string; views: number; sessions: number; users: number }) => ({
      name: p.platform || 'unknown',
      views: p.views,
      sessions: p.sessions,
      users: p.users,
    })
  );

  return (
    <Box>
      <PageHeader
        eyebrow="Monitor"
        title="Analytics"
        description={
          fullAnalytics
            ? 'Errors, page engagement, and users by platform'
            : 'Limited error summary for your assigned projects'
        }
        actions={
          <FormControl size="small" sx={{ minWidth: 200 }}>
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
                <MenuItem key={p._id} value={p._id}>
                  {p.projectName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        }
      />

      {fullAnalytics && (
        <>
      <Typography variant="h6" sx={{ mb: 1.5 }}>Engagement</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Page views', value: engagement?.summary?.pageViews ?? '—' },
          { label: 'Unique sessions', value: engagement?.summary?.uniqueSessions ?? '—' },
          { label: 'Unique users', value: engagement?.summary?.uniqueUsers ?? '—' },
          {
            label: 'Top platform',
            value: engagement?.summary?.maxUsersPlatform
              ? `${engagement.summary.maxUsersPlatform.platform} (${engagement.summary.maxUsersPlatform.users} users)`
              : '—',
          },
        ].map((m) => (
          <Grid item xs={12} sm={6} md={3} key={m.label}>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="body2" color="text.secondary">{m.label}</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                {m.value}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2.5, height: 320 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Users by platform</Typography>
            {platformData.length ? (
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie data={platformData} dataKey="users" nameKey="name" outerRadius={90} label>
                    {platformData.map((entry: { name: string }) => (
                      <Cell
                        key={entry.name}
                        fill={PLATFORM_COLORS[entry.name] || PLATFORM_COLORS.unknown}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Typography color="text.secondary">No page views yet — open the demo app to collect engagement.</Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2.5, height: 320 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Engagement over time</Typography>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={engagement?.timeline || []}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="views" stroke={chartColors.secondary} strokeWidth={2.5} dot={false} name="Views" />
                <Line type="monotone" dataKey="sessions" stroke={chartColors.primary} strokeWidth={2.5} dot={false} name="Sessions" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Top pages</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Path</TableCell>
              <TableCell align="right">Views</TableCell>
              <TableCell align="right">Sessions</TableCell>
              <TableCell align="right">Avg duration</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(engagement?.topPages || []).map(
              (p: { path: string; views: number; sessions: number; avgDurationMs?: number }) => (
                <TableRow key={p.path}>
                  <TableCell sx={{ fontFamily: '"IBM Plex Mono", monospace' }}>{p.path}</TableCell>
                  <TableCell align="right">{p.views}</TableCell>
                  <TableCell align="right">{p.sessions}</TableCell>
                  <TableCell align="right">
                    {p.avgDurationMs ? `${Math.round(p.avgDurationMs / 1000)}s` : '—'}
                  </TableCell>
                </TableRow>
              )
            )}
            {!engagement?.topPages?.length && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary">No page data yet</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {(engagement?.byPlatform || []).length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {engagement.byPlatform.map(
              (p: { platform: string; views: number; sessions: number; users: number }) => (
                <Chip
                  key={p.platform}
                  label={`${p.platform}: ${p.users} users · ${p.sessions} sessions · ${p.views} views`}
                  sx={{ textTransform: 'capitalize' }}
                />
              )
            )}
          </Box>
        )}
      </Paper>
        </>
      )}

      <Typography variant="h6" sx={{ mb: 1.5 }}>Errors</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Errors', value: data?.summary?.totalErrors ?? '—' },
          { label: 'Unique Errors', value: data?.summary?.uniqueErrors ?? '—' },
          { label: 'Resolved', value: data?.summary?.resolvedErrors ?? '—' },
          {
            label: 'Resolution Rate',
            value: data ? `${(data.summary.resolutionRate * 100).toFixed(0)}%` : '—',
          },
        ].map((m) => (
          <Grid item xs={12} sm={6} md={3} key={m.label}>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="body2" color="text.secondary">{m.label}</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{m.value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2.5, height: 360 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Errors over time</Typography>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={data?.timeline || []}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke={chartColors.primary} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, height: 360 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>By severity</Typography>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={severityData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill={chartColors.secondary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
