import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import {
  authenticate,
  requireProjectAccess,
  requirePermission,
  authorize,
  AuthRequest,
} from '../middleware/auth';
import { hasPermission } from '../rbac/permissions';
import * as projectService from '../services/projectService';
import * as errorService from '../services/errorService';
import * as ticketService from '../services/ticketService';
import * as versionService from '../services/versionService';
import * as analyticsService from '../services/analyticsService';
import { Project } from '../models/Project';
import { generateApiKey } from '../utils/crypto';
import { Types } from 'mongoose';
import { success, created, fail, getPagination, paginationMeta } from '../utils/response';

const router = Router();

const createProjectSchema = z.object({
  projectName: z.string().min(2),
  description: z.string().optional(),
  environments: z.record(z.unknown()).optional(),
  githubUrl: z.string().url().optional().or(z.literal('')),
  repositoryBranch: z.string().optional(),
  stagingUrl: z.string().optional(),
  productionUrl: z.string().optional(),
  clientName: z.string().optional(),
  clientCompany: z.string().optional(),
  supportEmail: z.string().email().optional().or(z.literal('')),
  supportPhone: z.string().optional(),
  slaNotes: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  developerEmails: z.array(z.string().email()).optional(),
  clientAdmin: z
    .object({
      fullName: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      username: z.string().optional(),
      password: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

router.use(authenticate);

router.post(
  '/',
  authorize('admin', 'product_manager'),
  requirePermission('projects:create'),
  validateBody(createProjectSchema),
  async (req: AuthRequest, res) => {
    try {
      const project = await projectService.createProject(req.user!._id.toString(), req.body);
      return created(res, project);
    } catch (err) {
      const e = err as Error;
      return fail(res, 500, 'ERROR', e.message);
    }
  }
);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page, limit } = getPagination(req);
    const { projects, total } = await projectService.listProjects(
      req.user!._id.toString(),
      req.user!.role,
      page,
      limit
    );
    return success(res, { projects, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    const e = err as Error;
    return fail(res, 500, 'ERROR', e.message);
  }
});

router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const data = await projectService.getProjectsOverview(
      req.user!._id.toString(),
      req.user!.role
    );
    return success(res, data);
  } catch (err) {
    const e = err as Error;
    return fail(res, 500, 'ERROR', e.message);
  }
});

router.get('/:projectId', requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    const project = await projectService.getProject(req.params.projectId);
    return success(res, {
      ...project,
      myPermissions: req.permissions || [],
      myProjectRole: req.projectRole,
    });
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return fail(res, e.status || 500, e.code || 'ERROR', e.message);
  }
});

router.get(
  '/:projectId/client-admin-password',
  requireProjectAccess,
  requirePermission('client_admin:reveal'),
  async (req: AuthRequest, res) => {
    try {
      const data = await projectService.getClientAdminPassword(
        req.params.projectId,
        req.user!.role
      );
      return success(res, data);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

// --- Git-backed versions ---
router.get(
  '/:projectId/versions',
  requireProjectAccess,
  requirePermission('versions:read'),
  async (req, res) => {
    try {
      const versions = await versionService.listVersions(req.params.projectId);
      return success(res, { versions });
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.get(
  '/:projectId/git/commits',
  requireProjectAccess,
  requirePermission('versions:read'),
  async (req, res) => {
    try {
      const limit = parseInt(String(req.query.limit || '20'), 10);
      const data = await versionService.listGitCommits(req.params.projectId, limit);
      return success(res, data);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.post(
  '/:projectId/versions/sync-git',
  requireProjectAccess,
  requirePermission('versions:write'),
  async (req, res) => {
    try {
      const result = await versionService.syncVersionsFromGit(req.params.projectId, {
        includeCommits: req.body.includeCommits,
        includeTags: req.body.includeTags,
        limit: req.body.limit,
      });
      return success(res, result);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.post(
  '/:projectId/versions/from-commit',
  requireProjectAccess,
  requirePermission('versions:write'),
  async (req, res) => {
    try {
      const result = await versionService.createVersionFromCommit(req.params.projectId, req.body);
      return created(res, result);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.post(
  '/:projectId/versions',
  requireProjectAccess,
  requirePermission('versions:write'),
  async (req, res) => {
    try {
      if (!req.body.version) return fail(res, 400, 'BAD_REQUEST', 'version is required');
      const version = await versionService.addManualVersion(req.params.projectId, req.body);
      return created(res, version);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.patch(
  '/:projectId',
  requireProjectAccess,
  requirePermission('projects:settings'),
  async (req, res) => {
    try {
      const project = await projectService.updateProject(req.params.projectId, req.body);
      return success(res, project);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.post(
  '/:projectId/api-keys',
  requireProjectAccess,
  requirePermission('projects:api_keys'),
  async (req, res) => {
    try {
      const { name, expiresIn } = req.body;
      if (!name) return fail(res, 400, 'BAD_REQUEST', 'name is required');
      const key = await projectService.createApiKey(req.params.projectId, name, expiresIn);
      return created(res, key);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.delete(
  '/:projectId/api-keys/:keyId',
  requireProjectAccess,
  requirePermission('projects:api_keys'),
  async (req, res) => {
    try {
      await projectService.revokeApiKey(req.params.projectId, req.params.keyId);
      return success(res, null, 200, { message: 'API key revoked' });
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.get(
  '/:projectId/member-candidates',
  requireProjectAccess,
  requirePermission('projects:members'),
  async (req, res) => {
    try {
      const users = await projectService.listMemberCandidates(
        req.params.projectId,
        req.query.search as string
      );
      return success(res, { users });
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.post(
  '/:projectId/members',
  requireProjectAccess,
  requirePermission('projects:members'),
  async (req, res) => {
    try {
      const { email, userId, role } = req.body || {};
      if (!email && !userId) {
        return fail(res, 400, 'BAD_REQUEST', 'userId or email is required');
      }
      const member = await projectService.addMember(req.params.projectId, {
        email,
        userId,
        role: role || 'developer',
      });
      return created(res, member);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.patch(
  '/:projectId/members/:userId',
  requireProjectAccess,
  requirePermission('projects:members'),
  async (req, res) => {
    try {
      const { role } = req.body || {};
      if (!role) return fail(res, 400, 'BAD_REQUEST', 'role is required');
      const member = await projectService.updateMemberRole(
        req.params.projectId,
        req.params.userId,
        role
      );
      return success(res, member);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.delete(
  '/:projectId/members/:userId',
  requireProjectAccess,
  requirePermission('projects:members'),
  async (req, res) => {
    try {
      await projectService.removeMember(req.params.projectId, req.params.userId);
      return success(res, null, 200, { message: 'Member removed' });
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.post(
  '/:projectId/tickets',
  requireProjectAccess,
  requirePermission('tickets:write'),
  async (req: AuthRequest, res) => {
  try {
    const ticket = await ticketService.createTicket(
      req.params.projectId,
      req.user!._id.toString(),
      req.body
    );
    return created(res, ticket);
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return fail(res, e.status || 500, e.code || 'ERROR', e.message);
  }
});

router.get(
  '/:projectId/tickets',
  requireProjectAccess,
  requirePermission('tickets:read'),
  async (req, res) => {
    try {
      const { page, limit } = getPagination(req);
      const { tickets, total } = await ticketService.listTickets(
        req.params.projectId,
        {
          status: req.query.status as string,
          priority: req.query.priority as string,
          assignedTo: req.query.assignedTo as string,
          search: req.query.search as string,
        },
        page,
        limit
      );
      return success(res, { tickets, pagination: paginationMeta(page, limit, total) });
    } catch (err) {
      const e = err as Error;
      return fail(res, 500, 'ERROR', e.message);
    }
  }
);

router.get(
  '/:projectId/tickets/:ticketId',
  requireProjectAccess,
  requirePermission('tickets:read'),
  async (req, res) => {
    try {
      const ticket = await ticketService.getTicket(req.params.projectId, req.params.ticketId);
      return success(res, ticket);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.patch(
  '/:projectId/tickets/:ticketId',
  requireProjectAccess,
  requirePermission('tickets:write'),
  async (req: AuthRequest, res) => {
    try {
      const ticket = await ticketService.updateTicket(
        req.params.projectId,
        req.params.ticketId,
        req.user!._id.toString(),
        req.body
      );
      return success(res, ticket);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.post(
  '/:projectId/tickets/:ticketId/comments',
  requireProjectAccess,
  requirePermission('tickets:write'),
  async (req: AuthRequest, res) => {
    try {
      const { content } = req.body;
      if (!content) return fail(res, 400, 'BAD_REQUEST', 'content is required');
      const comment = await ticketService.addComment(
        req.params.projectId,
        req.params.ticketId,
        req.user!._id.toString(),
        content
      );
      return created(res, comment);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.post(
  '/:projectId/tickets/:ticketId/attachments',
  requireProjectAccess,
  requirePermission('tickets:write'),
  async (req: AuthRequest, res) => {
    try {
      const { filename, dataUrl } = req.body || {};
      if (!filename || !dataUrl) {
        return fail(res, 400, 'BAD_REQUEST', 'filename and dataUrl are required');
      }
      const attachment = await ticketService.addAttachment(
        req.params.projectId,
        req.params.ticketId,
        req.user!._id.toString(),
        { filename, dataUrl }
      );
      return created(res, attachment);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.get(
  '/:projectId/analytics',
  requireProjectAccess,
  requirePermission('analytics:read'),
  async (req: AuthRequest, res) => {
    try {
      const [data, engagement] = await Promise.all([
        errorService.getAnalytics(
          req.params.projectId,
          req.query.dateFrom as string,
          req.query.dateTo as string
        ),
        analyticsService.getEngagementAnalytics(
          req.params.projectId,
          req.query.dateFrom as string,
          req.query.dateTo as string
        ),
      ]);

      // Developers get limited analytics (summary + short timeline only)
      if (!hasPermission(req.permissions, 'analytics:full')) {
        return success(res, {
          summary: data.summary,
          timeline: (data.timeline || []).slice(-7),
          limited: true,
        });
      }

      return success(res, { ...data, engagement });
    } catch (err) {
      const e = err as Error;
      return fail(res, 500, 'ERROR', e.message);
    }
  }
);

router.get(
  '/:projectId/analytics/dashboard',
  requireProjectAccess,
  requirePermission('analytics:read'),
  async (req, res) => {
    try {
      const data = await errorService.getDashboard(req.params.projectId);
      return success(res, data);
    } catch (err) {
      const e = err as Error;
      return fail(res, 500, 'ERROR', e.message);
    }
  }
);

router.get(
  '/:projectId/analytics/export',
  requireProjectAccess,
  requirePermission('analytics:export'),
  async (req, res) => {
    try {
      const data = await errorService.getAnalytics(
        req.params.projectId,
        req.query.dateFrom as string,
        req.query.dateTo as string
      );
      const format = (req.query.format as string) || 'json';
      if (format === 'csv') {
        const rows = ['date,count', ...data.timeline.map((t) => `${t.date},${t.count}`)].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
        return res.send(rows);
      }
      return success(res, data);
    } catch (err) {
      const e = err as Error;
      return fail(res, 500, 'ERROR', e.message);
    }
  }
);

router.post(
  '/:projectId/maintenance',
  requireProjectAccess,
  requirePermission('maintenance:write'),
  async (req: AuthRequest, res) => {
    try {
      const project = await Project.findById(req.params.projectId);
      if (!project) return fail(res, 404, 'NOT_FOUND', 'Project not found');

      const {
        title,
        description,
        startTime,
        endTime,
        severity,
        affectedComponents,
        suppressErrors,
      } = req.body;
      if (!title || !startTime || !endTime) {
        return fail(res, 400, 'BAD_REQUEST', 'title, startTime, and endTime are required');
      }

      const start = new Date(startTime);
      const end = new Date(endTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return fail(res, 400, 'BAD_REQUEST', 'Invalid startTime or endTime');
      }

      const wantOngoing = req.body.status === 'ongoing';
      if (wantOngoing && start.getTime() > Date.now()) {
        start.setTime(Date.now() - 1000);
      }

      project.maintenance.push({
        _id: new Types.ObjectId(),
        title,
        description,
        startTime: start,
        endTime: end,
        status: wantOngoing ? 'ongoing' : 'scheduled',
        severity: severity || 'medium',
        affectedComponents: affectedComponents || [],
        suppressErrors: suppressErrors !== false,
        createdBy: req.user!._id,
      });
      await project.save();
      return created(res, project.maintenance[project.maintenance.length - 1]);
    } catch (err) {
      const e = err as Error;
      return fail(res, 500, 'ERROR', e.message);
    }
  }
);

router.get(
  '/:projectId/maintenance',
  requireProjectAccess,
  requirePermission('maintenance:read'),
  async (req, res) => {
    try {
      const project = await Project.findById(req.params.projectId).select('maintenance');
      if (!project) return fail(res, 404, 'NOT_FOUND', 'Project not found');
      return success(res, { maintenance: project.maintenance });
    } catch (err) {
      const e = err as Error;
      return fail(res, 500, 'ERROR', e.message);
    }
  }
);

router.patch(
  '/:projectId/maintenance/:maintenanceId',
  requireProjectAccess,
  requirePermission('maintenance:write'),
  async (req, res) => {
    try {
      const project = await Project.findById(req.params.projectId);
      if (!project) return fail(res, 404, 'NOT_FOUND', 'Project not found');
      const item = project.maintenance.find((m) => m._id.toString() === req.params.maintenanceId);
      if (!item) return fail(res, 404, 'NOT_FOUND', 'Maintenance window not found');

      const body = { ...req.body };
      if (body.startTime) body.startTime = new Date(body.startTime);
      if (body.endTime) body.endTime = new Date(body.endTime);
      if (
        body.status === 'ongoing' &&
        body.startTime instanceof Date &&
        body.startTime.getTime() > Date.now()
      ) {
        body.startTime = new Date(Date.now() - 1000);
      }

      Object.assign(item, body);
      await project.save();
      return success(res, item);
    } catch (err) {
      const e = err as Error;
      return fail(res, 500, 'ERROR', e.message);
    }
  }
);

router.post(
  '/:projectId/webhooks',
  requireProjectAccess,
  requirePermission('projects:webhooks'),
  async (req, res) => {
    try {
      const project = await Project.findById(req.params.projectId);
      if (!project) return fail(res, 404, 'NOT_FOUND', 'Project not found');
      const { name, url, events } = req.body;
      if (!name || !url) return fail(res, 400, 'BAD_REQUEST', 'name and url are required');

      const secret = generateApiKey('whsec');
      project.webhooks.push({
        _id: new Types.ObjectId(),
        name,
        url,
        events: events || ['error.created'],
        isActive: true,
        secret,
        createdAt: new Date(),
      });
      await project.save();
      return created(res, project.webhooks[project.webhooks.length - 1]);
    } catch (err) {
      const e = err as Error;
      return fail(res, 500, 'ERROR', e.message);
    }
  }
);

export default router;
