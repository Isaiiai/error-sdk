import { useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from './store';

export type Permission =
  | 'users:manage'
  | 'users:read'
  | 'projects:create'
  | 'projects:settings'
  | 'projects:api_keys'
  | 'projects:webhooks'
  | 'projects:members'
  | 'versions:read'
  | 'versions:write'
  | 'errors:read'
  | 'errors:write'
  | 'tickets:read'
  | 'tickets:write'
  | 'analytics:read'
  | 'analytics:full'
  | 'analytics:export'
  | 'maintenance:read'
  | 'maintenance:write'
  | 'client_admin:reveal';

const PLATFORM_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'users:manage',
    'users:read',
    'projects:create',
    'projects:settings',
    'projects:api_keys',
    'projects:webhooks',
    'projects:members',
    'versions:read',
    'versions:write',
    'errors:read',
    'errors:write',
    'tickets:read',
    'tickets:write',
    'analytics:read',
    'analytics:full',
    'analytics:export',
    'maintenance:read',
    'maintenance:write',
    'client_admin:reveal',
  ],
  product_manager: [
    'users:read',
    'projects:create',
    'projects:members',
    'versions:read',
    'versions:write',
    'errors:read',
    'errors:write',
    'tickets:read',
    'tickets:write',
    'analytics:read',
    'analytics:full',
    'analytics:export',
    'maintenance:read',
    'maintenance:write',
    'client_admin:reveal',
  ],
  developer: [
    'versions:read',
    'errors:read',
    'errors:write',
    'tickets:read',
    'tickets:write',
    'analytics:read',
    'maintenance:read',
  ],
};

export function permissionsForRole(role?: string | null): Permission[] {
  if (!role) return PLATFORM_PERMISSIONS.developer;
  return PLATFORM_PERMISSIONS[role] || PLATFORM_PERMISSIONS.developer;
}

export function can(permissions: readonly string[] | undefined, ...needed: Permission[]): boolean {
  if (!permissions?.length) return false;
  return needed.every((p) => permissions.includes(p));
}

export function usePermissions() {
  const user = useSelector((s: RootState) => s.auth.user);
  const permissions = useMemo(() => {
    if (user?.permissions?.length) return user.permissions as Permission[];
    return permissionsForRole(user?.role);
  }, [user]);

  const canFn = useCallback(
    (...needed: Permission[]) => can(permissions, ...needed),
    [permissions]
  );

  return {
    user,
    role: user?.role || 'developer',
    permissions,
    can: canFn,
    isAdmin: user?.role === 'admin',
    isPm: user?.role === 'product_manager',
    isDeveloper: user?.role === 'developer',
  };
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  product_manager: 'Product Manager',
  developer: 'Developer',
};
