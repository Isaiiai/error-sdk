import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import {
  authenticate,
  requirePermission,
  AuthRequest,
} from '../middleware/auth';
import { hasPermission } from '../rbac/permissions';
import * as userService from '../services/userService';
import { success, created, fail, getPagination, paginationMeta } from '../utils/response';

const router = Router();

const passwordSchema = z
  .string()
  .min(12)
  .regex(/[A-Z]/, 'Must contain uppercase')
  .regex(/[a-z]/, 'Must contain lowercase')
  .regex(/[0-9]/, 'Must contain number')
  .regex(/[^A-Za-z0-9]/, 'Must contain special character');

const createUserSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  fullName: z.string().min(2),
  role: z.enum(['admin', 'product_manager', 'developer']).optional(),
  username: z.string().min(3).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  username: z.string().min(3).optional(),
  role: z.enum(['admin', 'product_manager', 'developer']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  emailVerified: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  password: passwordSchema,
});

const bulkStatusSchema = z.object({
  userIds: z.array(z.string()).min(1).max(50),
  status: z.enum(['active', 'inactive', 'suspended']),
});

router.use(authenticate);

/** Lightweight directory for project member pickers (Admin + PM). */
router.get('/directory', requirePermission('users:read'), async (req: AuthRequest, res) => {
  try {
    const users = await userService.listUserDirectory({
      search: req.query.search as string,
      status: (req.query.status as string) || 'active',
    });
    return success(res, { users });
  } catch (err) {
    const e = err as Error;
    return fail(res, 500, 'ERROR', e.message);
  }
});

router.use((req: AuthRequest, res, next) => {
  if (!hasPermission(req.permissions, 'users:manage')) {
    return fail(res, 403, 'FORBIDDEN', 'Missing permission: users:manage');
  }
  next();
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page, limit } = getPagination(req);
    const { users, total } = await userService.listUsers(
      {
        search: req.query.search as string,
        role: req.query.role as string,
        status: req.query.status as string,
      },
      page,
      limit
    );
    return success(res, { users, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    const e = err as Error;
    return fail(res, 500, 'ERROR', e.message);
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const user = await userService.getUser(req.params.userId);
    return success(res, user);
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return fail(res, e.status || 500, e.code || 'ERROR', e.message);
  }
});

router.post('/', validateBody(createUserSchema), async (req: AuthRequest, res) => {
  try {
    const user = await userService.createUser(req.user!._id.toString(), req.body);
    return created(res, user);
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return fail(res, e.status || 500, e.code || 'ERROR', e.message);
  }
});

router.patch('/:userId', validateBody(updateUserSchema), async (req: AuthRequest, res) => {
  try {
    const user = await userService.updateUser(
      req.user!._id.toString(),
      req.params.userId,
      req.body
    );
    return success(res, user);
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return fail(res, e.status || 500, e.code || 'ERROR', e.message);
  }
});

router.post(
  '/:userId/reset-password',
  validateBody(resetPasswordSchema),
  async (req: AuthRequest, res) => {
    try {
      const result = await userService.resetUserPassword(
        req.user!._id.toString(),
        req.params.userId,
        req.body.password
      );
      return success(res, result, 200, { message: 'Password updated' });
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };
      return fail(res, e.status || 500, e.code || 'ERROR', e.message);
    }
  }
);

router.post('/bulk/status', validateBody(bulkStatusSchema), async (req: AuthRequest, res) => {
  try {
    const result = await userService.bulkUpdateStatus(
      req.user!._id.toString(),
      req.body.userIds,
      req.body.status
    );
    return success(res, result);
  } catch (err) {
    const e = err as Error;
    return fail(res, 500, 'ERROR', e.message);
  }
});

router.delete('/:userId', async (req: AuthRequest, res) => {
  try {
    const hard = String(req.query.hard || '') === 'true';
    const result = await userService.deleteUser(
      req.user!._id.toString(),
      req.params.userId,
      hard
    );
    return success(res, result, 200, {
      message: hard ? 'User deleted' : 'User suspended',
    });
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return fail(res, e.status || 500, e.code || 'ERROR', e.message);
  }
});

export default router;
