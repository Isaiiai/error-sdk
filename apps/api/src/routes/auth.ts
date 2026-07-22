import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as authService from '../services/authService';
import { success, created, fail } from '../utils/response';
import { User } from '../models/User';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(12)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  fullName: z.string().min(2),
  role: z.enum(['product_manager', 'developer']).optional(),
  username: z.string().min(3).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', validateBody(registerSchema), async (req, res) => {
  try {
    const user = await authService.registerUser(req.body);
    const token = authService.signAccessToken(user);
    return created(
      res,
      {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
      },
      { token }
    );
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return fail(res, e.status || 500, e.code || 'ERROR', e.message);
  }
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
  try {
    const result = await authService.loginUser(req.body.email, req.body.password, {
      ip: req.ip,
      ua: req.headers['user-agent'],
    });
    return success(res, result);
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    return fail(res, e.status || 500, e.code || 'ERROR', e.message);
  }
});

router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return fail(res, 400, 'BAD_REQUEST', 'refreshToken is required');
    }
    const payload = authService.verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.userId);
    if (!user || user.status !== 'active') {
      return fail(res, 401, 'UNAUTHORIZED', 'Invalid refresh token');
    }
    const accessToken = authService.signAccessToken(user);
    return success(res, { accessToken, expiresIn: 3600 });
  } catch {
    return fail(res, 401, 'UNAUTHORIZED', 'Invalid or expired refresh token');
  }
});

router.post('/logout', authenticate, async (_req, res) => {
  return success(res, null, 200, { message: 'Logged out successfully' });
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  return success(res, authService.sanitizeUser(req.user!));
});

export default router;
