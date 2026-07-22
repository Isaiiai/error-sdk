import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { authenticateApiKey, AuthRequest } from '../middleware/auth';
import * as supportService from '../services/supportService';
import { created, success, fail } from '../utils/response';

const router = Router();

const attachmentSchema = z.object({
  filename: z.string().min(1).max(200),
  dataUrl: z.string().min(20).max(12_000_000),
  contentType: z.string().optional(),
});

const supportSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(5).max(5000),
  category: z
    .enum(['feature_request', 'bug', 'performance', 'security', 'question', 'other'])
    .optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  reporterName: z.string().max(120).optional(),
  reporterEmail: z.string().email().optional().or(z.literal('')),
  pageUrl: z.string().optional(),
  platform: z.record(z.unknown()).optional(),
  attachments: z.array(attachmentSchema).max(5).optional(),
  tags: z.array(z.string()).optional(),
});

router.post(
  '/tickets',
  authenticateApiKey,
  validateBody(supportSchema),
  async (req: AuthRequest, res) => {
    try {
      const result = await supportService.createSupportTicket(req.projectId!, {
        ...req.body,
        reporterEmail: req.body.reporterEmail || undefined,
      });
      return created(res, result);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.get('/tickets', authenticateApiKey, async (req: AuthRequest, res) => {
  try {
    const tickets = await supportService.listSupportTickets(req.projectId!, {
      email: req.query.email as string | undefined,
      status: req.query.status as string | undefined,
    });
    return success(res, { tickets });
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return fail(res, e.status || 500, e.code || 'ERROR', e.message);
  }
});

router.get('/tickets/:ticketId', authenticateApiKey, async (req: AuthRequest, res) => {
  try {
    const ticket = await supportService.getSupportTicket(
      req.projectId!,
      req.params.ticketId,
      req.query.email as string | undefined
    );
    return success(res, ticket);
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return fail(res, e.status || 500, e.code || 'ERROR', e.message);
  }
});

router.post(
  '/tickets/:ticketId/comments',
  authenticateApiKey,
  validateBody(
    z.object({
      content: z.string().min(1).max(5000),
      authorName: z.string().optional(),
      email: z.string().email().optional(),
    })
  ),
  async (req: AuthRequest, res) => {
    try {
      const comment = await supportService.addSupportComment(
        req.projectId!,
        req.params.ticketId,
        req.body
      );
      return created(res, comment);
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

export default router;
