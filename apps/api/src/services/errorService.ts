import { Types } from 'mongoose';
import { ErrorEvent, IErrorEvent, Severity, Environment } from '../models/ErrorEvent';
import { ErrorGroup } from '../models/ErrorGroup';
import { Project, IProject } from '../models/Project';
import { ServiceTicket } from '../models/ServiceTicket';
import { computeFingerprint, nextTicketNumber } from '../utils/crypto';

export interface IngestErrorInput {
  message: string;
  errorType: string;
  severity?: Severity;
  stackTrace?: string;
  sourceMap?: IErrorEvent['sourceMap'];
  environment?: Environment;
  version?: string;
  browser?: IErrorEvent['browser'];
  device?: IErrorEvent['device'];
  url?: string;
  user?: {
    id?: string;
    userId?: string;
    username?: string;
    email?: string;
    customData?: Record<string, unknown>;
  };
  sessionId?: string;
  breadcrumbs?: Array<{
    timestamp?: string | Date;
    category: string;
    message: string;
    level?: string;
    data?: Record<string, unknown>;
  }>;
  context?: {
    customData?: Record<string, unknown>;
    tags?: string[];
    release?: string;
  };
  fingerprint?: string[];
  screenshot?: {
    data: string;
    contentType?: string;
    width?: number;
    height?: number;
    capturedAt?: string | Date;
  };
  platform?: Record<string, unknown>;
  networkActivity?: IErrorEvent['networkActivity'];
}

const MAX_SCREENSHOT_LENGTH = 600_000; // ~450KB data URL

async function resolveScreenshot(
  projectId: string,
  screenshot?: IngestErrorInput['screenshot']
): Promise<IErrorEvent['screenshot'] | undefined> {
  if (!screenshot?.data || typeof screenshot.data !== 'string') return undefined;
  if (!screenshot.data.startsWith('data:image/')) return undefined;
  if (screenshot.data.length > MAX_SCREENSHOT_LENGTH) return undefined;

  const { uploadScreenshot } = await import('./storageService');
  const uploaded = await uploadScreenshot({
    projectId,
    dataUrl: screenshot.data,
    contentType: screenshot.contentType,
    width: screenshot.width,
    height: screenshot.height,
    capturedAt: screenshot.capturedAt ? new Date(screenshot.capturedAt) : new Date(),
  });

  return {
    data: uploaded.storage === 'inline' ? uploaded.data : undefined,
    url: uploaded.url || undefined,
    key: uploaded.key || undefined,
    storage: uploaded.storage,
    contentType: uploaded.contentType,
    width: uploaded.width || 0,
    height: uploaded.height || 0,
    capturedAt: uploaded.capturedAt,
  };
}

function isInMaintenance(project: IProject): boolean {
  const now = new Date();
  return project.maintenance.some(
    (m) =>
      m.suppressErrors &&
      (m.status === 'ongoing' || m.status === 'scheduled') &&
      m.startTime <= now &&
      m.endTime >= now
  );
}

export async function ingestError(project: IProject, input: IngestErrorInput) {
  if (isInMaintenance(project)) {
    return {
      errorId: null,
      groupId: null,
      isDuplicate: false,
      suppressed: true,
      message: 'Error suppressed during maintenance window',
    };
  }

  if (Math.random() > (project.settings.sampleRate ?? 1)) {
    return {
      errorId: null,
      groupId: null,
      isDuplicate: false,
      sampled: true,
      message: 'Error dropped due to sample rate',
    };
  }

  const fingerprint =
    input.fingerprint?.join(':') ||
    computeFingerprint(input.message, input.errorType, input.stackTrace);

  let urlPath: string | undefined;
  try {
    if (input.url) urlPath = new URL(input.url).pathname;
  } catch {
    urlPath = input.url;
  }

  const userId = input.user?.id || input.user?.userId;
  const now = new Date();

  const existing = await ErrorEvent.findOne({
    projectId: project._id,
    fingerprint,
    isResolved: false,
  });

  if (existing && project.settings.enableErrorGrouping) {
    existing.occurrenceCount += 1;
    existing.lastOccurrence = now;
    existing.isDuplicate = true;

    if (userId && !existing.uniqueAffectedUsers.includes(userId)) {
      existing.uniqueAffectedUsers.push(userId);
      existing.affectedUsers = existing.uniqueAffectedUsers.length;
    }

    // Keep the latest screenshot so the admin sees the most recent UI state
    const screenshot = await resolveScreenshot(project._id.toString(), input.screenshot);
    if (screenshot) {
      existing.screenshot = screenshot;
    }
    if (input.platform) {
      existing.platform = input.platform;
    }

    await existing.save();

    if (existing.groupId) {
      await ErrorGroup.findByIdAndUpdate(existing.groupId, {
        $inc: { errorCount: 1 },
        lastOccurrence: now,
        mostRecentErrorId: existing._id,
        ...(userId ? { $addToSet: {} } : {}),
      });

      const group = await ErrorGroup.findById(existing.groupId);
      if (group && userId) {
        group.affectedUsersCount = Math.max(group.affectedUsersCount, existing.affectedUsers);
        await group.save();
      }
    }

    await maybeAutoCreateTicket(project, existing);

    return {
      errorId: existing._id.toString(),
      groupId: existing.groupId?.toString() || null,
      isDuplicate: true,
      message: 'Error captured successfully',
    };
  }

  let group = await ErrorGroup.findOne({
    projectId: project._id,
    fingerprints: fingerprint,
  });

  if (!group) {
    const priority =
      input.severity === 'info'
        ? 'low'
        : (input.severity as 'critical' | 'high' | 'medium' | 'low') || 'medium';

    group = await ErrorGroup.create({
      projectId: project._id,
      name: `${input.errorType}: ${input.message.slice(0, 120)}`,
      fingerprints: [fingerprint],
      errorCount: 1,
      affectedUsersCount: userId ? 1 : 0,
      firstOccurrence: now,
      lastOccurrence: now,
      priority,
      tags: input.context?.tags || [],
    });
  } else {
    group.errorCount += 1;
    group.lastOccurrence = now;
    if (group.status === 'resolved') {
      group.status = 'regressed';
      group.isResolved = false;
    }
    await group.save();
  }

  const error = await ErrorEvent.create({
    projectId: project._id,
    groupId: group._id,
    message: input.message,
    errorType: input.errorType,
    severity: input.severity || 'medium',
    stackTrace: input.stackTrace,
    sourceMap: input.sourceMap,
    environment: input.environment || 'production',
    version: input.version,
    browser: input.browser,
    device: input.device,
    url: input.url,
    urlPath,
    user: userId
      ? {
          userId,
          username: input.user?.username,
          email: input.user?.email,
          customData: input.user?.customData,
        }
      : undefined,
    sessionId: input.sessionId,
    breadcrumbs: (input.breadcrumbs || []).map((b) => ({
      timestamp: b.timestamp ? new Date(b.timestamp) : now,
      category: b.category,
      message: b.message,
      level: b.level || 'info',
      data: b.data,
    })),
    context: input.context,
    screenshot: await resolveScreenshot(project._id.toString(), input.screenshot),
    platform: input.platform,
    networkActivity: (input.networkActivity || input.context?.customData?.networkActivity as IErrorEvent['networkActivity'])?.map((entry) => ({
      ...entry,
      timestamp: entry.timestamp ? new Date(entry.timestamp) : now,
    })),
    fingerprint,
    isDuplicate: false,
    occurrenceCount: 1,
    firstOccurrence: now,
    lastOccurrence: now,
    affectedUsers: userId ? 1 : 0,
    uniqueAffectedUsers: userId ? [userId] : [],
  });

  group.mostRecentErrorId = error._id;
  await group.save();

  await maybeAutoCreateTicket(project, error);

  return {
    errorId: error._id.toString(),
    groupId: group._id.toString(),
    isDuplicate: false,
    message: 'Error captured successfully',
  };
}

async function maybeAutoCreateTicket(project: IProject, error: IErrorEvent) {
  if (!project.settings.enableAutoTicketCreation) return;
  if (error.occurrenceCount < (project.settings.autoTicketThreshold || 10)) return;
  if (error.linkedTicketId) return;

  project.ticketCounter = (project.ticketCounter || 0) + 1;
  await project.save();

  const ticket = await ServiceTicket.create({
    projectId: project._id,
    ticketNumber: nextTicketNumber(project.ticketCounter - 1),
    title: `[Auto] ${error.errorType}: ${error.message.slice(0, 80)}`,
    description: `Auto-created from error with ${error.occurrenceCount} occurrences.\n\n${error.stackTrace || ''}`,
    linkedErrorIds: [error._id],
    linkedErrorGroupIds: error.groupId ? [error.groupId] : [],
    status: 'open',
    priority: error.severity === 'info' ? 'low' : error.severity,
    severity: error.severity === 'info' ? 'low' : error.severity,
    category: 'bug',
    type: 'incident',
    createdBy: project.ownerId,
    assignedTo: project.settings.ticketAssigneeId || project.ownerId,
    tags: ['auto-created'],
    environment: error.environment,
    activityLog: [
      {
        action: 'created',
        performedBy: project.ownerId,
        timestamp: new Date(),
      },
    ],
  });

  error.linkedTicketId = ticket._id;
  await error.save();
}

export async function listErrors(
  projectId: string,
  filters: {
    severity?: string;
    environment?: string;
    isResolved?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  page: number,
  limit: number
) {
  const query: Record<string, unknown> = { projectId };

  if (filters.severity) {
    query.severity = { $in: filters.severity.split(',') };
  }
  if (filters.environment) {
    query.environment = filters.environment;
  }
  if (filters.isResolved !== undefined) {
    query.isResolved = filters.isResolved === 'true';
  }
  if (filters.search) {
    query.message = { $regex: filters.search, $options: 'i' };
  }
  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {};
    if (filters.dateFrom) {
      (query.createdAt as Record<string, Date>).$gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      (query.createdAt as Record<string, Date>).$lte = new Date(filters.dateTo);
    }
  }

  const sortBy = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;

  const [errors, total] = await Promise.all([
    ErrorEvent.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        'message errorType severity environment occurrenceCount affectedUsers isResolved createdAt lastOccurrence groupId version url'
      )
      .lean(),
    ErrorEvent.countDocuments(query),
  ]);

  return { errors, total };
}

export async function getError(errorId: string) {
  const error = await ErrorEvent.findById(errorId)
    .populate('assignedTo', 'fullName email')
    .populate('resolvedBy', 'fullName email')
    .populate('comments.authorId', 'fullName email');
  if (!error) {
    const err = new Error('Error not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  return error;
}

export async function updateError(
  errorId: string,
  updates: {
    isResolved?: boolean;
    resolutionNotes?: string;
    assignedTo?: string;
    severity?: Severity;
  },
  userId: string
) {
  const error = await ErrorEvent.findById(errorId);
  if (!error) {
    const err = new Error('Error not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (updates.isResolved !== undefined) {
    error.isResolved = updates.isResolved;
    if (updates.isResolved) {
      error.resolvedAt = new Date();
      error.resolvedBy = new Types.ObjectId(userId);
      if (error.groupId) {
        await ErrorGroup.findByIdAndUpdate(error.groupId, {
          isResolved: true,
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: userId,
        });
      }
    }
  }
  if (updates.resolutionNotes !== undefined) error.resolutionNotes = updates.resolutionNotes;
  if (updates.assignedTo !== undefined) error.assignedTo = new Types.ObjectId(updates.assignedTo);
  if (updates.severity !== undefined) error.severity = updates.severity;

  await error.save();
  return error;
}

export async function getSimilarErrors(
  errorId: string
): Promise<
  Array<{
    _id: Types.ObjectId;
    message: string;
    occurrenceCount: number;
    fingerprint: string;
    errorType: string;
    createdAt: Date;
    similarity: number;
  }>
> {
  const error = await ErrorEvent.findById(errorId);
  if (!error) {
    const err = new Error('Error not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const similar = await ErrorEvent.find({
    projectId: error.projectId,
    _id: { $ne: error._id },
    $or: [
      { fingerprint: error.fingerprint },
      { errorType: error.errorType, message: { $regex: error.message.slice(0, 40), $options: 'i' } },
    ],
  })
    .limit(10)
    .select('message occurrenceCount fingerprint errorType createdAt')
    .lean();

  return similar.map((s) => ({
    _id: s._id as Types.ObjectId,
    message: s.message,
    occurrenceCount: s.occurrenceCount,
    fingerprint: s.fingerprint,
    errorType: s.errorType,
    createdAt: s.createdAt,
    similarity: s.fingerprint === error.fingerprint ? 1 : 0.7,
  }));
}

export async function getAnalytics(projectId: string, dateFrom?: string, dateTo?: string) {
  const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = dateTo ? new Date(dateTo) : new Date();

  const match = {
    projectId: new Types.ObjectId(projectId),
    createdAt: { $gte: from, $lte: to },
  };

  const [totals, bySeverity, byEnvironment, timeline, topErrors] = await Promise.all([
    ErrorEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalErrors: { $sum: '$occurrenceCount' },
          uniqueErrors: { $sum: 1 },
          resolvedErrors: { $sum: { $cond: ['$isResolved', 1, 0] } },
          affectedUsers: { $sum: '$affectedUsers' },
        },
      },
    ]),
    ErrorEvent.aggregate([
      { $match: match },
      { $group: { _id: '$severity', count: { $sum: '$occurrenceCount' } } },
    ]),
    ErrorEvent.aggregate([
      { $match: match },
      { $group: { _id: '$environment', count: { $sum: '$occurrenceCount' } } },
    ]),
    ErrorEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: '$occurrenceCount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    ErrorEvent.find(match)
      .sort({ occurrenceCount: -1 })
      .limit(10)
      .select('message errorType severity occurrenceCount affectedUsers')
      .lean(),
  ]);

  const t = totals[0] || {
    totalErrors: 0,
    uniqueErrors: 0,
    resolvedErrors: 0,
    affectedUsers: 0,
  };

  const severityMap: Record<string, number> = {};
  bySeverity.forEach((s) => {
    severityMap[s._id] = s.count;
  });

  return {
    summary: {
      totalErrors: t.totalErrors,
      uniqueErrors: t.uniqueErrors,
      criticalErrors: severityMap.critical || 0,
      highErrors: severityMap.high || 0,
      mediumErrors: severityMap.medium || 0,
      lowErrors: severityMap.low || 0,
      infoErrors: severityMap.info || 0,
      resolvedErrors: t.resolvedErrors,
      affectedUsers: t.affectedUsers,
      resolutionRate: t.uniqueErrors ? t.resolvedErrors / t.uniqueErrors : 0,
    },
    byEnvironment,
    timeline: timeline.map((d) => ({ date: d._id, count: d.count })),
    topErrors,
    period: { from, to },
  };
}

export async function getDashboard(projectId: string) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [openErrors, criticalToday, totalToday, openTickets, recentErrors] = await Promise.all([
    ErrorEvent.countDocuments({ projectId, isResolved: false }),
    ErrorEvent.countDocuments({
      projectId,
      severity: 'critical',
      createdAt: { $gte: dayAgo },
    }),
    ErrorEvent.countDocuments({ projectId, createdAt: { $gte: dayAgo } }),
    ServiceTicket.countDocuments({
      projectId,
      status: { $in: ['open', 'in_progress'] },
    }),
    ErrorEvent.find({ projectId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('message severity environment occurrenceCount createdAt isResolved')
      .lean(),
  ]);

  return {
    openErrors,
    criticalToday,
    totalToday,
    openTickets,
    recentErrors,
  };
}
