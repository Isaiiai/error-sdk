import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User, IUser } from '../models/User';
import { Project } from '../models/Project';
import { ErrorEvent } from '../models/ErrorEvent';
import { hashKey } from '../utils/crypto';
import { fail } from '../utils/response';
import {
  effectivePermissions,
  hasPermission,
  platformPermissions,
  type Permission,
  type ProjectMemberRole,
} from '../rbac/permissions';

export interface AuthRequest extends Request {
  user?: IUser;
  projectId?: string;
  /** Membership role on the current project (null for platform admin bypass). */
  projectRole?: ProjectMemberRole | null;
  /** Effective permissions for the current request scope. */
  permissions?: Permission[];
}

interface JwtPayload {
  userId: string;
  role: string;
}

async function attachProjectAccess(req: AuthRequest, projectId: string): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  if (!req.user) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'Authentication required' };
  }

  if (req.user.role === 'admin') {
    req.projectId = projectId;
    req.projectRole = null;
    req.permissions = effectivePermissions('admin');
    return { ok: true };
  }

  const project = await Project.findOne({
    _id: projectId,
    $or: [{ ownerId: req.user._id }, { 'members.userId': req.user._id }],
  });

  if (!project) {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'No access to this project' };
  }

  let projectRole: ProjectMemberRole | null = null;
  if (project.ownerId?.toString() === req.user._id.toString()) {
    projectRole = 'owner';
  } else {
    const member = project.members.find((m) => m.userId.toString() === req.user!._id.toString());
    projectRole = (member?.role as ProjectMemberRole) || 'developer';
  }

  req.projectId = projectId;
  req.projectRole = projectRole;
  req.permissions = effectivePermissions(req.user.role, projectRole);
  return { ok: true };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return fail(res, 401, 'UNAUTHORIZED', 'Missing or invalid authorization header');
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    const user = await User.findById(payload.userId);

    if (!user || user.status !== 'active') {
      return fail(res, 401, 'UNAUTHORIZED', 'Invalid token or inactive user');
    }

    req.user = user;
    req.permissions = platformPermissions(user.role);
    next();
  } catch {
    return fail(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
}

/** Require one of the listed platform roles (admin always allowed). */
export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    }
    if (roles.length && !roles.includes(req.user.role) && req.user.role !== 'admin') {
      return fail(res, 403, 'FORBIDDEN', 'Insufficient permissions');
    }
    next();
  };
}

/** Require specific permission(s) on the current request (uses req.permissions). */
export function requirePermission(...needed: Permission[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    }
    if (!hasPermission(req.permissions, needed)) {
      return fail(res, 403, 'FORBIDDEN', `Missing permission: ${needed.join(', ')}`);
    }
    next();
  };
}

export async function authenticateApiKey(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectKey = (req.headers['x-project-key'] || req.headers['x-api-key']) as string;
    const secretKey = req.headers['x-secret-key'] as string;

    if (!projectKey || !secretKey) {
      return fail(res, 401, 'UNAUTHORIZED', 'Missing X-Project-Key or X-Secret-Key headers');
    }

    const keyHash = hashKey(projectKey);
    const secretHash = hashKey(secretKey);

    const project = await Project.findOne({
      'apiKeys.keyHash': keyHash,
      'apiKeys.status': 'active',
      status: 'active',
    });

    if (!project) {
      return fail(res, 401, 'UNAUTHORIZED', 'Invalid project key');
    }

    const apiKey = project.apiKeys.find((k) => k.keyHash === keyHash && k.status === 'active');
    if (!apiKey || apiKey.secretKeyHash !== secretHash) {
      return fail(res, 401, 'UNAUTHORIZED', 'Invalid secret key');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return fail(res, 401, 'UNAUTHORIZED', 'API key expired');
    }

    apiKey.lastUsed = new Date();
    await project.save();

    req.projectId = project._id.toString();
    next();
  } catch {
    return fail(res, 500, 'INTERNAL_ERROR', 'API key authentication failed');
  }
}

export async function requireProjectAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const projectId = (req.params.projectId || req.query.projectId || req.projectId) as string;
    if (!projectId) {
      return fail(res, 400, 'BAD_REQUEST', 'projectId is required');
    }

    const result = await attachProjectAccess(req, projectId);
    if (!result.ok) {
      return fail(res, result.status, result.code, result.message);
    }
    next();
  } catch {
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to verify project access');
  }
}

/** Resolve error → project, then enforce membership (+ optional permissions). */
export function requireErrorAccess(...needed: Permission[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
      }

      const error = await ErrorEvent.findById(req.params.errorId).select('projectId');
      if (!error) {
        return fail(res, 404, 'NOT_FOUND', 'Error not found');
      }

      const projectId = error.projectId.toString();
      req.params.projectId = projectId;

      const result = await attachProjectAccess(req, projectId);
      if (!result.ok) {
        return fail(res, result.status, result.code, result.message);
      }

      if (needed.length && !hasPermission(req.permissions, needed)) {
        return fail(res, 403, 'FORBIDDEN', `Missing permission: ${needed.join(', ')}`);
      }
      next();
    } catch {
      return fail(res, 500, 'INTERNAL_ERROR', 'Failed to verify error access');
    }
  };
}
