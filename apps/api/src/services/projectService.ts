import { Types } from 'mongoose';
import { Project, IProject } from '../models/Project';
import { User } from '../models/User';
import { ErrorEvent } from '../models/ErrorEvent';
import { ServiceTicket } from '../models/ServiceTicket';
import { PageView } from '../models/PageView';
import { Notification } from '../models/Notification';
import { generateApiKey, hashKey, slugify } from '../utils/crypto';
import { encryptSecret, decryptSecret, maskSecret } from '../utils/encryption';
import { AuditLog } from '../models/AuditLog';

export interface CreateProjectInput {
  projectName: string;
  description?: string;
  environments?: Record<string, unknown>;
  githubUrl?: string;
  repositoryBranch?: string;
  stagingUrl?: string;
  productionUrl?: string;
  clientName?: string;
  clientCompany?: string;
  supportEmail?: string;
  supportPhone?: string;
  slaNotes?: string;
  techStack?: string[];
  developerEmails?: string[];
  clientAdmin?: {
    fullName?: string;
    email?: string;
    username?: string;
    password?: string;
    notes?: string;
  };
}

export async function createProject(ownerId: string, data: CreateProjectInput) {
  let baseSlug = slugify(data.projectName);
  let slug = baseSlug;
  let i = 1;
  while (await Project.findOne({ projectSlug: slug })) {
    slug = `${baseSlug}-${i++}`;
  }

  const publicKey = generateApiKey('pub');
  const secretKey = generateApiKey('sec');

  const developerEmails = (data.developerEmails || [])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const members: IProject['members'] = [
    {
      userId: new Types.ObjectId(ownerId),
      role: 'owner',
      joinedAt: new Date(),
      permissions: ['*'],
    },
  ];

  // Auto-add existing users matching developer emails
  if (developerEmails.length) {
    const developers = await User.find({ email: { $in: developerEmails } });
    for (const dev of developers) {
      if (dev._id.toString() === ownerId) continue;
      members.push({
        userId: dev._id,
        role: 'developer',
        joinedAt: new Date(),
        permissions: [],
      });
    }
  }

  const project = await Project.create({
    projectName: data.projectName,
    projectSlug: slug,
    description: data.description,
    ownerId,
    members,
    apiKeys: [
      {
        name: 'Default Key',
        key: publicKey.slice(0, 12) + '...',
        keyHash: hashKey(publicKey),
        secretKeyHash: hashKey(secretKey),
        status: 'active',
        permissions: ['errors:write', 'errors:read', 'support:write'],
      },
    ],
    environments: data.environments || {
      ...(data.stagingUrl ? { staging: { apiUrl: data.stagingUrl } } : {}),
      ...(data.productionUrl ? { production: { apiUrl: data.productionUrl } } : {}),
    },
    maintenanceProfile: {
      clientName: data.clientName,
      clientCompany: data.clientCompany,
      githubUrl: data.githubUrl,
      repositoryBranch: data.repositoryBranch || 'main',
      stagingUrl: data.stagingUrl,
      productionUrl: data.productionUrl,
      supportEmail: data.supportEmail,
      supportPhone: data.supportPhone,
      slaNotes: data.slaNotes,
      techStack: data.techStack || [],
      developerEmails,
      clientAdmin: data.clientAdmin
        ? {
            fullName: data.clientAdmin.fullName,
            email: data.clientAdmin.email,
            username: data.clientAdmin.username,
            passwordEnc: data.clientAdmin.password
              ? encryptSecret(data.clientAdmin.password)
              : undefined,
            notes: data.clientAdmin.notes,
          }
        : undefined,
    },
  });

  // Notify added developers
  for (const m of members) {
    if (m.role === 'developer') {
      await Notification.create({
        userId: m.userId,
        projectId: project._id,
        type: 'project.assigned',
        title: `Added to ${project.projectName}`,
        message: `You were added as a developer on ${project.projectName}.`,
        link: `/projects/${project._id}`,
      });
    }
  }

  await AuditLog.create({
    userId: ownerId,
    projectId: project._id,
    action: 'project.create',
    resource: 'project',
    resourceId: project._id.toString(),
  });

  return {
    ...sanitizeProject(project),
    apiKeys: [
      {
        _id: project.apiKeys[0]._id,
        name: 'Default Key',
        key: publicKey,
        secretKey,
        status: 'active',
        createdAt: project.apiKeys[0].createdAt,
      },
    ],
  };
}

export function sanitizeProject(project: IProject) {
  const obj = project.toObject();
  const admin = obj.maintenanceProfile?.clientAdmin;
  return {
    ...obj,
    apiKeys: (obj.apiKeys || []).map((k: IProject['apiKeys'][number]) => ({
      _id: k._id,
      name: k.name,
      key: k.key,
      status: k.status,
      lastUsed: k.lastUsed,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
      permissions: k.permissions,
    })),
    maintenanceProfile: {
      ...obj.maintenanceProfile,
      clientAdmin: admin
        ? {
            fullName: admin.fullName,
            email: admin.email,
            username: admin.username,
            passwordMasked: admin.passwordEnc ? maskSecret(decryptSecret(admin.passwordEnc)) : '',
            hasPassword: !!admin.passwordEnc,
            notes: admin.notes,
          }
        : undefined,
    },
  };
}

export async function listProjects(userId: string, role: string, page: number, limit: number) {
  const filter =
    role === 'admin'
      ? {}
      : { $or: [{ ownerId: userId }, { 'members.userId': userId }] };

  const [projects, total] = await Promise.all([
    Project.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Project.countDocuments(filter),
  ]);

  const withCounts = await Promise.all(
    projects.map(async (p) => {
      const errorCount = await ErrorEvent.countDocuments({ projectId: p._id });
      const member = p.members.find((m) => m.userId.toString() === userId);
      return {
        _id: p._id,
        projectName: p.projectName,
        projectSlug: p.projectSlug,
        description: p.description,
        githubUrl: p.maintenanceProfile?.githubUrl,
        clientName: p.maintenanceProfile?.clientName,
        role: member?.role || (p.ownerId.toString() === userId ? 'owner' : 'member'),
        members: p.members.length,
        errorCount,
        status: p.status,
        createdAt: p.createdAt,
      };
    })
  );

  return { projects: withCounts, total };
}

/** Cross-project overview for the Dashboard (all projects the user can access). */
export async function getProjectsOverview(userId: string, role: string) {
  const filter =
    role === 'admin'
      ? {}
      : { $or: [{ ownerId: userId }, { 'members.userId': userId }] };

  const projects = await Project.find(filter)
    .select('projectName projectSlug status members ownerId createdAt maintenance')
    .sort({ projectName: 1 })
    .lean();

  const projectIds = projects.map((p) => p._id);
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (!projectIds.length) {
    return {
      totals: {
        projects: 0,
        activeProjects: 0,
        openErrors: 0,
        errorsToday: 0,
        criticalToday: 0,
        openTickets: 0,
        totalErrors30d: 0,
        uniqueErrors30d: 0,
        resolvedErrors30d: 0,
        pageViews30d: 0,
        sessions30d: 0,
        maintenanceActive: 0,
      },
      projects: [],
      timeline: [],
      bySeverity: [],
    };
  }

  const [
    openErrorsByProject,
    todayByProject,
    criticalTodayByProject,
    openTicketsByProject,
    totals30d,
    severity30d,
    timeline30d,
    pageViews30d,
    sessions30d,
  ] = await Promise.all([
    ErrorEvent.aggregate([
      { $match: { projectId: { $in: projectIds }, isResolved: false } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]),
    ErrorEvent.aggregate([
      { $match: { projectId: { $in: projectIds }, createdAt: { $gte: dayAgo } } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]),
    ErrorEvent.aggregate([
      {
        $match: {
          projectId: { $in: projectIds },
          severity: 'critical',
          createdAt: { $gte: dayAgo },
        },
      },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]),
    ServiceTicket.aggregate([
      {
        $match: {
          projectId: { $in: projectIds },
          status: { $in: ['open', 'in_progress'] },
        },
      },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]),
    ErrorEvent.aggregate([
      {
        $match: {
          projectId: { $in: projectIds },
          createdAt: { $gte: thirtyAgo },
        },
      },
      {
        $group: {
          _id: null,
          totalErrors: { $sum: '$occurrenceCount' },
          uniqueErrors: { $sum: 1 },
          resolvedErrors: { $sum: { $cond: ['$isResolved', 1, 0] } },
        },
      },
    ]),
    ErrorEvent.aggregate([
      {
        $match: {
          projectId: { $in: projectIds },
          createdAt: { $gte: thirtyAgo },
        },
      },
      { $group: { _id: '$severity', count: { $sum: '$occurrenceCount' } } },
      { $sort: { count: -1 } },
    ]),
    ErrorEvent.aggregate([
      {
        $match: {
          projectId: { $in: projectIds },
          createdAt: { $gte: thirtyAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: '$occurrenceCount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    PageView.countDocuments({
      projectId: { $in: projectIds },
      createdAt: { $gte: thirtyAgo },
    }),
    PageView.distinct('sessionId', {
      projectId: { $in: projectIds },
      createdAt: { $gte: thirtyAgo },
    }),
  ]);

  const toMap = (rows: Array<{ _id: Types.ObjectId; count: number }>) => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r._id.toString(), r.count));
    return map;
  };

  const openMap = toMap(openErrorsByProject);
  const todayMap = toMap(todayByProject);
  const criticalMap = toMap(criticalTodayByProject);
  const ticketsMap = toMap(openTicketsByProject);

  const projectRows = projects.map((p) => {
    const id = p._id.toString();
    const liveMaintenance = (p.maintenance || []).some(
      (m: { status?: string; startTime?: Date; endTime?: Date }) =>
        m.status !== 'completed' &&
        m.startTime &&
        m.endTime &&
        new Date(m.startTime).getTime() <= now.getTime() &&
        new Date(m.endTime).getTime() >= now.getTime()
    );
    return {
      _id: id,
      projectName: p.projectName,
      projectSlug: p.projectSlug,
      status: p.status,
      members: p.members?.length || 0,
      openErrors: openMap.get(id) || 0,
      errorsToday: todayMap.get(id) || 0,
      criticalToday: criticalMap.get(id) || 0,
      openTickets: ticketsMap.get(id) || 0,
      maintenanceActive: liveMaintenance,
      createdAt: p.createdAt,
    };
  });

  const t30 = totals30d[0] || { totalErrors: 0, uniqueErrors: 0, resolvedErrors: 0 };

  const totals = {
    projects: projects.length,
    activeProjects: projects.filter((p) => p.status === 'active').length,
    openErrors: projectRows.reduce((s, p) => s + p.openErrors, 0),
    errorsToday: projectRows.reduce((s, p) => s + p.errorsToday, 0),
    criticalToday: projectRows.reduce((s, p) => s + p.criticalToday, 0),
    openTickets: projectRows.reduce((s, p) => s + p.openTickets, 0),
    totalErrors30d: t30.totalErrors,
    uniqueErrors30d: t30.uniqueErrors,
    resolvedErrors30d: t30.resolvedErrors,
    resolutionRate: t30.uniqueErrors ? t30.resolvedErrors / t30.uniqueErrors : 0,
    pageViews30d,
    sessions30d: sessions30d.length,
    maintenanceActive: projectRows.filter((p) => p.maintenanceActive).length,
  };

  return {
    totals,
    projects: projectRows.sort((a, b) => b.openErrors - a.openErrors || b.errorsToday - a.errorsToday),
    timeline: timeline30d.map((d) => ({ date: d._id, count: d.count })),
    bySeverity: severity30d.map((s) => ({
      name: s._id || 'unknown',
      count: s.count,
    })),
    period: { from: thirtyAgo, to: now },
  };
}

export async function getProject(projectId: string) {
  const project = await Project.findById(projectId)
    .populate('ownerId', 'email fullName')
    .populate('members.userId', 'email fullName role');
  if (!project) {
    const err = new Error('Project not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  return sanitizeProject(project);
}

export async function getClientAdminPassword(projectId: string, requesterRole: string) {
  if (requesterRole !== 'admin' && requesterRole !== 'product_manager') {
    const err = new Error('Insufficient permissions') as Error & { status: number; code: string };
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  const project = await Project.findById(projectId);
  if (!project?.maintenanceProfile?.clientAdmin?.passwordEnc) {
    const err = new Error('No client admin password stored') as Error & {
      status: number;
      code: string;
    };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  return {
    password: decryptSecret(project.maintenanceProfile.clientAdmin.passwordEnc),
    username: project.maintenanceProfile.clientAdmin.username,
    email: project.maintenanceProfile.clientAdmin.email,
  };
}

export async function updateProject(projectId: string, updates: Record<string, unknown>) {
  const set: Record<string, unknown> = { ...updates };

  if (updates.maintenanceProfile && typeof updates.maintenanceProfile === 'object') {
    const profile = updates.maintenanceProfile as CreateProjectInput & {
      clientAdmin?: CreateProjectInput['clientAdmin'] & { password?: string };
    };
    const existing = await Project.findById(projectId);
    const nextProfile = {
      ...(existing?.maintenanceProfile || {}),
      ...profile,
    };
    if (profile.clientAdmin) {
      nextProfile.clientAdmin = {
        ...(existing?.maintenanceProfile?.clientAdmin || {}),
        ...profile.clientAdmin,
        passwordEnc: profile.clientAdmin.password
          ? encryptSecret(profile.clientAdmin.password)
          : existing?.maintenanceProfile?.clientAdmin?.passwordEnc,
      };
      delete (nextProfile.clientAdmin as { password?: string }).password;
    }
    set.maintenanceProfile = nextProfile;
  }

  const project = await Project.findByIdAndUpdate(
    projectId,
    { $set: set },
    { new: true, runValidators: true }
  );
  if (!project) {
    const err = new Error('Project not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  return sanitizeProject(project);
}

export async function createApiKey(
  projectId: string,
  name: string,
  expiresInSeconds?: number
) {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const publicKey = generateApiKey('pub');
  const secretKey = generateApiKey('sec');
  const expiresAt = expiresInSeconds
    ? new Date(Date.now() + expiresInSeconds * 1000)
    : undefined;

  project.apiKeys.push({
    _id: new Types.ObjectId(),
    name,
    key: publicKey.slice(0, 12) + '...',
    keyHash: hashKey(publicKey),
    secretKeyHash: hashKey(secretKey),
    status: 'active',
    createdAt: new Date(),
    expiresAt,
    permissions: ['errors:write', 'errors:read', 'support:write'],
  });

  await project.save();
  const created = project.apiKeys[project.apiKeys.length - 1];

  return {
    _id: created._id,
    key: publicKey,
    secretKey,
    name,
    createdAt: created.createdAt,
    expiresAt,
  };
}

export async function revokeApiKey(projectId: string, keyId: string) {
  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error('Project not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const key = project.apiKeys.find((k) => k._id.toString() === keyId);
  if (!key) {
    const err = new Error('API key not found') as Error & { status: number; code: string };
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  key.status = 'inactive';
  await project.save();
}

export async function listMemberCandidates(projectId: string, search?: string) {
  const project = await Project.findById(projectId).select('members ownerId');
  if (!project) throw httpError('Project not found', 404, 'NOT_FOUND');

  const memberIds = new Set(project.members.map((m) => m.userId.toString()));
  memberIds.add(project.ownerId.toString());

  const query: Record<string, unknown> = {
    status: 'active',
    _id: { $nin: [...memberIds] },
  };
  if (search?.trim()) {
    const q = search.trim();
    query.$or = [
      { email: { $regex: q, $options: 'i' } },
      { fullName: { $regex: q, $options: 'i' } },
      { username: { $regex: q, $options: 'i' } },
    ];
  }

  const users = await User.find(query)
    .sort({ fullName: 1 })
    .limit(100)
    .select('email fullName username role status');

  return users.map((u) => ({
    id: u._id.toString(),
    email: u.email,
    fullName: u.fullName,
    username: u.username,
    role: u.role,
    status: u.status,
  }));
}

export async function addMember(
  projectId: string,
  input: { email?: string; userId?: string; role?: string }
) {
  const role = input.role || 'developer';
  if (!['owner', 'manager', 'developer'].includes(role)) {
    throw httpError('Invalid project role', 400, 'INVALID_ROLE');
  }

  let user = null;
  if (input.userId) {
    user = await User.findById(input.userId);
  } else if (input.email) {
    user = await User.findOne({ email: input.email.toLowerCase() });
  } else {
    throw httpError('userId or email is required', 400, 'BAD_REQUEST');
  }

  if (!user) {
    throw httpError('User not found — invite them from Users first', 404, 'USER_NOT_FOUND');
  }

  if (user.status !== 'active') {
    throw httpError('Only active users can be added to a project', 400, 'USER_INACTIVE');
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw httpError('Project not found', 404, 'NOT_FOUND');
  }

  if (project.members.some((m) => m.userId.toString() === user!._id.toString())) {
    throw httpError('User is already a member', 409, 'ALREADY_MEMBER');
  }

  project.members.push({
    userId: user._id,
    role: role as 'owner' | 'manager' | 'developer',
    joinedAt: new Date(),
    permissions: [],
  });
  await project.save();

  await Notification.create({
    userId: user._id,
    projectId: project._id,
    type: 'project.assigned',
    title: `Added to ${project.projectName}`,
    message: `You were added as ${role} on ${project.projectName}.`,
    link: `/projects/${project._id}`,
  });

  return {
    userId: user._id.toString(),
    email: user.email,
    fullName: user.fullName,
    platformRole: user.role,
    role,
    joinedAt: new Date(),
  };
}

function httpError(message: string, status: number, code: string) {
  const err = new Error(message) as Error & { status: number; code: string };
  err.status = status;
  err.code = code;
  return err;
}

export async function updateMemberRole(projectId: string, userId: string, role: string) {
  if (!['owner', 'manager', 'developer'].includes(role)) {
    throw httpError('Invalid project role', 400, 'INVALID_ROLE');
  }

  const project = await Project.findById(projectId);
  if (!project) throw httpError('Project not found', 404, 'NOT_FOUND');

  if (project.ownerId.toString() === userId && role !== 'owner') {
    throw httpError('Cannot change the project owner role here', 400, 'OWNER_ROLE_LOCKED');
  }

  const member = project.members.find((m) => m.userId.toString() === userId);
  if (!member) throw httpError('Member not found', 404, 'NOT_FOUND');

  member.role = role as 'owner' | 'manager' | 'developer';
  await project.save();
  return { userId, role };
}

export async function removeMember(projectId: string, userId: string) {
  const project = await Project.findById(projectId);
  if (!project) {
    throw httpError('Project not found', 404, 'NOT_FOUND');
  }

  if (project.ownerId.toString() === userId) {
    throw httpError('Cannot remove project owner', 400, 'CANNOT_REMOVE_OWNER');
  }

  project.members = project.members.filter((m) => m.userId.toString() !== userId);
  await project.save();
}
