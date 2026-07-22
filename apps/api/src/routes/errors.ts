import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import {
  authenticate,
  authenticateApiKey,
  requireProjectAccess,
  requirePermission,
  requireErrorAccess,
  AuthRequest,
} from '../middleware/auth';
import * as errorService from '../services/errorService';
import { Project } from '../models/Project';
import { success, created, fail, getPagination, paginationMeta } from '../utils/response';

const router = Router();

const ingestSchema = z.object({
  message: z.string().min(1),
  errorType: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  stackTrace: z.string().optional(),
  sourceMap: z
    .object({
      file: z.string().optional(),
      line: z.number().optional(),
      column: z.number().optional(),
      context: z.string().optional(),
    })
    .optional(),
  environment: z.enum(['development', 'staging', 'production']).optional(),
  version: z.string().optional(),
  browser: z
    .object({
      name: z.string().optional(),
      version: z.string().optional(),
      userAgent: z.string().optional(),
    })
    .optional(),
  device: z
    .object({
      type: z.enum(['mobile', 'tablet', 'desktop']).optional(),
      os: z.string().optional(),
      osVersion: z.string().optional(),
    })
    .optional(),
  url: z.string().optional(),
  user: z
    .object({
      id: z.string().optional(),
      userId: z.string().optional(),
      username: z.string().optional(),
      email: z.string().optional(),
      customData: z.record(z.unknown()).optional(),
    })
    .optional(),
  sessionId: z.string().optional(),
  breadcrumbs: z
    .array(
      z.object({
        timestamp: z.union([z.string(), z.date()]).optional(),
        category: z.string(),
        message: z.string(),
        level: z.string().optional(),
        data: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
  context: z
    .object({
      customData: z.record(z.unknown()).optional(),
      tags: z.array(z.string()).optional(),
      release: z.string().optional(),
    })
    .optional(),
  fingerprint: z.array(z.string()).optional(),
  screenshot: z
    .object({
      data: z.string().min(1).max(600_000),
      contentType: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      capturedAt: z.union([z.string(), z.date()]).optional(),
    })
    .optional(),
  platform: z.record(z.unknown()).optional(),
  networkActivity: z
    .array(
      z.object({
        timestamp: z.union([z.string(), z.date()]).optional(),
        type: z.enum(['fetch', 'xhr']),
        method: z.string(),
        url: z.string(),
        status: z.number().optional(),
        ok: z.boolean().optional(),
        durationMs: z.number(),
        requestBody: z.string().optional(),
        responseBody: z.string().optional(),
        error: z.string().optional(),
      })
    )
    .max(100)
    .optional(),
});

router.post('/', authenticateApiKey, validateBody(ingestSchema), async (req: AuthRequest, res) => {
  try {
    const project = await Project.findById(req.projectId);
    if (!project) {
      return fail(res, 404, 'NOT_FOUND', 'Project not found');
    }
    const result = await errorService.ingestError(project, req.body);
    return created(res, result);
  } catch (err) {
    const e = err as Error;
    return fail(res, 500, 'ERROR', e.message);
  }
});

router.get(
  '/',
  authenticate,
  requireProjectAccess,
  requirePermission('errors:read'),
  async (req: AuthRequest, res) => {
    try {
      const { page, limit } = getPagination(req);
      const { errors, total } = await errorService.listErrors(
        req.projectId!,
        {
          severity: req.query.severity as string,
          environment: req.query.environment as string,
          isResolved: req.query.isResolved as string,
          search: req.query.search as string,
          sortBy: req.query.sortBy as string,
          sortOrder: req.query.sortOrder as string,
          dateFrom: req.query.dateFrom as string,
          dateTo: req.query.dateTo as string,
        },
        page,
        limit
      );
      return success(res, { errors, pagination: paginationMeta(page, limit, total) });
    } catch (err) {
      const e = err as Error;
      return fail(res, 500, 'ERROR', e.message);
    }
  }
);

router.get('/:errorId', authenticate, requireErrorAccess('errors:read'), async (req, res) => {
  try {
    const error = await errorService.getError(req.params.errorId);
    return success(res, error);
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return fail(res, e.status || 500, e.code || 'ERROR', e.message);
  }
});

router.patch('/:errorId', authenticate, requireErrorAccess('errors:write'), async (req: AuthRequest, res) => {
  try {
    const error = await errorService.updateError(req.params.errorId, req.body, req.user!._id.toString());
    return success(res, error);
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return fail(res, e.status || 500, e.code || 'ERROR', e.message);
  }
});

router.get('/:errorId/similar', authenticate, requireErrorAccess('errors:read'), async (req, res) => {
  try {
    const similarErrors = await errorService.getSimilarErrors(req.params.errorId);
    return success(res, { similarErrors });
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return fail(res, e.status || 500, e.code || 'ERROR', e.message);
  }
});

export default router;
