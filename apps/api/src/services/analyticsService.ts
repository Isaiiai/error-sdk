import { Types } from 'mongoose';
import { PageView, DevicePlatform } from '../models/PageView';
import { Project } from '../models/Project';

export interface PageViewInput {
  sessionId: string;
  userId?: string;
  path: string;
  title?: string;
  referrer?: string;
  url?: string;
  platform?: DevicePlatform;
  runtime?: string;
  browser?: string;
  os?: string;
  durationMs?: number;
  engaged?: boolean;
  metadata?: Record<string, unknown>;
}

export async function ingestPageView(projectId: string, input: PageViewInput) {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const path = (input.path || '/').slice(0, 500);
  const doc = await PageView.create({
    projectId: new Types.ObjectId(projectId),
    sessionId: input.sessionId.slice(0, 120),
    userId: input.userId?.slice(0, 120),
    path,
    title: input.title?.slice(0, 300),
    referrer: input.referrer?.slice(0, 1000),
    url: input.url?.slice(0, 2000),
    platform: input.platform || 'unknown',
    runtime: input.runtime,
    browser: input.browser,
    os: input.os,
    durationMs: input.durationMs,
    engaged: input.engaged !== false,
    metadata: input.metadata,
  });

  return {
    id: doc._id.toString(),
    path: doc.path,
    platform: doc.platform,
  };
}

export async function getEngagementAnalytics(
  projectId: string,
  dateFrom?: string,
  dateTo?: string
) {
  const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = dateTo ? new Date(dateTo) : new Date();
  const match = {
    projectId: new Types.ObjectId(projectId),
    createdAt: { $gte: from, $lte: to },
  };

  const [totals, byPlatform, byPage, uniqueSessions, uniqueUsers, timeline] = await Promise.all([
    PageView.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          pageViews: { $sum: 1 },
          avgDurationMs: { $avg: '$durationMs' },
          engagedViews: { $sum: { $cond: ['$engaged', 1, 0] } },
        },
      },
    ]),
    PageView.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$platform',
          views: { $sum: 1 },
          sessions: { $addToSet: '$sessionId' },
          users: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          platform: '$_id',
          views: 1,
          sessions: { $size: '$sessions' },
          users: {
            $size: {
              $filter: {
                input: '$users',
                as: 'u',
                cond: { $and: [{ $ne: ['$$u', null] }, { $ne: ['$$u', ''] }] },
              },
            },
          },
        },
      },
      { $sort: { views: -1 } },
    ]),
    PageView.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$path',
          views: { $sum: 1 },
          sessions: { $addToSet: '$sessionId' },
          avgDurationMs: { $avg: '$durationMs' },
        },
      },
      {
        $project: {
          path: '$_id',
          views: 1,
          sessions: { $size: '$sessions' },
          avgDurationMs: 1,
        },
      },
      { $sort: { views: -1 } },
      { $limit: 20 },
    ]),
    PageView.distinct('sessionId', match),
    PageView.distinct('userId', {
      ...match,
      userId: { $exists: true, $nin: [null, ''] },
    }),
    PageView.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          views: { $sum: 1 },
          sessions: { $addToSet: '$sessionId' },
        },
      },
      {
        $project: {
          date: '$_id',
          views: 1,
          sessions: { $size: '$sessions' },
        },
      },
      { $sort: { date: 1 } },
    ]),
  ]);

  const summary = totals[0] || { pageViews: 0, avgDurationMs: 0, engagedViews: 0 };
  const maxPlatform = byPlatform[0] || null;

  return {
    period: { from, to },
    summary: {
      pageViews: summary.pageViews || 0,
      uniqueSessions: uniqueSessions.length,
      uniqueUsers: uniqueUsers.length,
      avgDurationMs: Math.round(summary.avgDurationMs || 0),
      engagementRate:
        summary.pageViews > 0
          ? Number(((summary.engagedViews || 0) / summary.pageViews).toFixed(3))
          : 0,
      maxUsersPlatform: maxPlatform
        ? {
            platform: maxPlatform.platform || 'unknown',
            users: maxPlatform.users || 0,
            sessions: maxPlatform.sessions || 0,
            views: maxPlatform.views || 0,
          }
        : null,
    },
    byPlatform,
    topPages: byPage,
    timeline,
  };
}

export async function getActiveMaintenance(projectId: string) {
  const project = await Project.findById(projectId).select('maintenance projectName');
  if (!project) {
    const err = new Error('Project not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const now = new Date();
  const active = project.maintenance.filter((m) => {
    if (m.status === 'completed') return false;
    const started = new Date(m.startTime).getTime() <= now.getTime();
    const notEnded = new Date(m.endTime).getTime() >= now.getTime();
    return (m.status === 'ongoing' || m.status === 'scheduled') && started && notEnded;
  });

  // Lazy-promote scheduled → ongoing when window is active
  let dirty = false;
  for (const m of project.maintenance) {
    const started = new Date(m.startTime).getTime() <= now.getTime();
    const notEnded = new Date(m.endTime).getTime() >= now.getTime();
    if (m.status === 'scheduled' && started && notEnded) {
      m.status = 'ongoing';
      dirty = true;
    } else if (
      (m.status === 'ongoing' || m.status === 'scheduled') &&
      new Date(m.endTime).getTime() < now.getTime()
    ) {
      m.status = 'completed';
      dirty = true;
    }
  }
  if (dirty) await project.save();

  return {
    active: active.length > 0,
    projectName: project.projectName,
    windows: active.map((m) => ({
      id: m._id.toString(),
      title: m.title,
      description: m.description,
      startTime: m.startTime,
      endTime: m.endTime,
      severity: m.severity,
      status: m.status,
      affectedComponents: m.affectedComponents,
    })),
  };
}
