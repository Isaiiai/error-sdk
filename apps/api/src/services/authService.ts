import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User, IUser, type UserRole } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { platformPermissions } from '../rbac/permissions';

export function signAccessToken(user: IUser): string {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
  );
}

export function signRefreshToken(user: IUser): string {
  return jwt.sign(
    { userId: user._id.toString(), type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn } as jwt.SignOptions
  );
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, config.jwt.refreshSecret) as { userId: string };
}

export async function registerUser(data: {
  email: string;
  password: string;
  fullName: string;
  role?: string;
  username?: string;
}) {
  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) {
    const err = new Error('User already exists') as Error & { code: string; status: number };
    err.code = 'USER_EXISTS';
    err.status = 409;
    throw err;
  }

  // Public registration cannot self-assign admin
  let role: UserRole = 'developer';
  if (data.role === 'product_manager' || data.role === 'developer') {
    role = data.role;
  }

  const username =
    data.username ||
    data.email.split('@')[0] + '_' + Math.random().toString(36).slice(2, 6);

  const user = await User.create({
    email: data.email.toLowerCase(),
    password: data.password,
    fullName: data.fullName,
    username,
    role,
  });

  await AuditLog.create({
    userId: user._id,
    action: 'user.register',
    resource: 'user',
    resourceId: user._id.toString(),
  });

  return user;
}

export async function loginUser(email: string, password: string, meta?: { ip?: string; ua?: string }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    const err = new Error('Invalid email or password') as Error & { code: string; status: number };
    err.code = 'INVALID_CREDENTIALS';
    err.status = 401;
    throw err;
  }

  if (user.status !== 'active') {
    const err = new Error('Account is not active') as Error & { code: string; status: number };
    err.code = 'ACCOUNT_INACTIVE';
    err.status = 403;
    throw err;
  }

  user.lastLogin = new Date();
  await user.save();

  await AuditLog.create({
    userId: user._id,
    action: 'user.login',
    resource: 'user',
    resourceId: user._id.toString(),
    ipAddress: meta?.ip,
    userAgent: meta?.ua,
  });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      username: user.username,
      permissions: platformPermissions(user.role),
    },
    tokens: { accessToken, refreshToken },
    expiresIn: 3600,
  };
}

export function sanitizeUser(user: IUser) {
  return {
    id: user._id.toString(),
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    username: user.username,
    status: user.status,
    emailVerified: user.emailVerified,
    lastLogin: user.lastLogin,
    preferences: user.preferences,
    permissions: platformPermissions(user.role),
    createdAt: user.createdAt,
  };
}
