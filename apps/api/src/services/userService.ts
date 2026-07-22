import { User, IUser, UserRole, UserStatus } from '../models/User';
import { Project } from '../models/Project';
import { AuditLog } from '../models/AuditLog';
import { platformPermissions } from '../rbac/permissions';
import { sanitizeUser } from './authService';

export interface ListUsersFilters {
  search?: string;
  role?: string;
  status?: string;
}

export async function listUserDirectory(filters: { search?: string; status?: string } = {}) {
  const query: Record<string, unknown> = {
    status: filters.status || 'active',
  };
  if (filters.search?.trim()) {
    const q = filters.search.trim();
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

function httpError(message: string, status: number, code: string) {
  const err = new Error(message) as Error & { status: number; code: string };
  err.status = status;
  err.code = code;
  return err;
}

async function countActiveAdmins(excludeUserId?: string) {
  const filter: Record<string, unknown> = { role: 'admin', status: 'active' };
  if (excludeUserId) filter._id = { $ne: excludeUserId };
  return User.countDocuments(filter);
}

export async function listUsers(filters: ListUsersFilters, page: number, limit: number) {
  const query: Record<string, unknown> = {};

  if (filters.role) query.role = filters.role;
  if (filters.status) query.status = filters.status;
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    query.$or = [
      { email: { $regex: q, $options: 'i' } },
      { fullName: { $regex: q, $options: 'i' } },
      { username: { $regex: q, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(query),
  ]);

  return {
    users: users.map((u) => sanitizeUser(u)),
    total,
  };
}

export async function getUser(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw httpError('User not found', 404, 'NOT_FOUND');

  const projects = await Project.find({
    $or: [{ ownerId: user._id }, { 'members.userId': user._id }],
  })
    .select('projectName projectSlug status members ownerId')
    .limit(50);

  const activity = await AuditLog.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('action resource resourceId createdAt metadata');

  const assignedProjects = projects.map((p) => {
    const member = p.members.find((m) => m.userId.toString() === userId);
    const projectRole =
      p.ownerId.toString() === userId ? 'owner' : member?.role || 'member';
    return {
      _id: p._id,
      projectName: p.projectName,
      projectSlug: p.projectSlug,
      status: p.status,
      projectRole,
    };
  });

  return {
    ...sanitizeUser(user),
    permissions: platformPermissions(user.role),
    assignedProjects,
    activity,
  };
}

export async function createUser(
  actorId: string,
  data: {
    email: string;
    password: string;
    fullName: string;
    role?: UserRole;
    username?: string;
    status?: UserStatus;
  }
) {
  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) throw httpError('User already exists', 409, 'USER_EXISTS');

  const username =
    data.username ||
    data.email.split('@')[0] + '_' + Math.random().toString(36).slice(2, 6);

  const user = await User.create({
    email: data.email.toLowerCase(),
    password: data.password,
    fullName: data.fullName,
    username,
    role: data.role || 'developer',
    status: data.status || 'active',
    emailVerified: true,
  });

  await AuditLog.create({
    userId: actorId,
    action: 'user.create',
    resource: 'user',
    resourceId: user._id.toString(),
    metadata: { email: user.email, role: user.role },
  });

  return sanitizeUser(user);
}

export async function updateUser(
  actorId: string,
  userId: string,
  updates: {
    fullName?: string;
    role?: UserRole;
    status?: UserStatus;
    username?: string;
    emailVerified?: boolean;
  }
) {
  const user = await User.findById(userId);
  if (!user) throw httpError('User not found', 404, 'NOT_FOUND');

  // Protect last active admin
  const demotingAdmin =
    user.role === 'admin' &&
    user.status === 'active' &&
    ((updates.role && updates.role !== 'admin') ||
      (updates.status && updates.status !== 'active'));

  if (demotingAdmin) {
    const remaining = await countActiveAdmins(userId);
    if (remaining < 1) {
      throw httpError('Cannot demote or suspend the last active admin', 400, 'LAST_ADMIN');
    }
  }

  if (actorId === userId && updates.role && updates.role !== 'admin') {
    throw httpError('You cannot change your own role', 400, 'SELF_ROLE_CHANGE');
  }

  if (updates.fullName !== undefined) user.fullName = updates.fullName;
  if (updates.username !== undefined) user.username = updates.username;
  if (updates.role !== undefined) user.role = updates.role;
  if (updates.status !== undefined) user.status = updates.status;
  if (updates.emailVerified !== undefined) user.emailVerified = updates.emailVerified;

  await user.save();

  await AuditLog.create({
    userId: actorId,
    action: 'user.update',
    resource: 'user',
    resourceId: userId,
    metadata: updates,
  });

  return sanitizeUser(user);
}

export async function resetUserPassword(
  actorId: string,
  userId: string,
  password: string
) {
  const user = await User.findById(userId).select('+password');
  if (!user) throw httpError('User not found', 404, 'NOT_FOUND');

  user.password = password;
  await user.save();

  await AuditLog.create({
    userId: actorId,
    action: 'user.reset_password',
    resource: 'user',
    resourceId: userId,
  });

  return { id: user._id.toString(), email: user.email };
}

export async function deleteUser(actorId: string, userId: string, hard = false) {
  if (actorId === userId) {
    throw httpError('You cannot delete your own account', 400, 'SELF_DELETE');
  }

  const user = await User.findById(userId);
  if (!user) throw httpError('User not found', 404, 'NOT_FOUND');

  if (user.role === 'admin' && user.status === 'active') {
    const remaining = await countActiveAdmins(userId);
    if (remaining < 1) {
      throw httpError('Cannot delete the last active admin', 400, 'LAST_ADMIN');
    }
  }

  if (hard) {
    await User.deleteOne({ _id: userId });
    await AuditLog.create({
      userId: actorId,
      action: 'user.delete',
      resource: 'user',
      resourceId: userId,
      metadata: { email: user.email, hard: true },
    });
    return { deleted: true };
  }

  user.status = 'suspended';
  await user.save();

  await AuditLog.create({
    userId: actorId,
    action: 'user.suspend',
    resource: 'user',
    resourceId: userId,
    metadata: { email: user.email },
  });

  return sanitizeUser(user);
}

export async function bulkUpdateStatus(
  actorId: string,
  userIds: string[],
  status: UserStatus
) {
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const id of userIds) {
    try {
      if (id === actorId && status !== 'active') {
        results.push({ id, ok: false, error: 'Cannot suspend yourself' });
        continue;
      }
      await updateUser(actorId, id, { status });
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: (err as Error).message });
    }
  }
  return { results };
}

export type { IUser };
