import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { authenticateApiKey, AuthRequest } from '../middleware/auth';
import * as analyticsService from '../services/analyticsService';
import { created, success, fail } from '../utils/response';

const router = Router();

const pageViewSchema = z.object({
  sessionId: z.string().min(1).max(120),
  userId: z.string().max(120).optional(),
  path: z.string().min(1).max(500),
  title: z.string().max(300).optional(),
  referrer: z.string().max(1000).optional(),
  url: z.string().max(2000).optional(),
  platform: z.enum(['mobile', 'tablet', 'desktop', 'webview', 'unknown']).optional(),
  runtime: z.string().max(80).optional(),
  browser: z.string().max(80).optional(),
  os: z.string().max(80).optional(),
  durationMs: z.number().min(0).max(86_400_000).optional(),
  engaged: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.post(
  '/pageviews',
  authenticateApiKey,
  validateBody(pageViewSchema),
  async (req: AuthRequest, res) => {
    try {
      const result = await analyticsService.ingestPageView(req.projectId!, req.body);
      return created(res, result);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.get('/maintenance/active', authenticateApiKey, async (req: AuthRequest, res) => {
  try {
    const data = await analyticsService.getActiveMaintenance(req.projectId!);
    return success(res, data);
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return fail(res, e.status || 500, e.code || 'ERROR', e.message);
  }
});

export default router;
