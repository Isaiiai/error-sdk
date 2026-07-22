import type { UserRole } from '../models/User';

export type ProjectMemberRole = 'owner' | 'manager' | 'developer';

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

/** Platform-level capabilities (before project membership). */
export const PLATFORM_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
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
    // No projects:settings / api_keys / webhooks (PRD)
  ],
  developer: [
    'versions:read',
    'errors:read',
    'errors:write',
    'tickets:read',
    'tickets:write',
    'analytics:read',
    'maintenance:read',
    // Limited analytics — no analytics:full / export
    // Cannot create projects, manage members/settings/keys, or write maintenance
  ],
};

/** Project membership elevates within a project (owner/manager). */
export const PROJECT_ROLE_PERMISSIONS: Record<ProjectMemberRole, readonly Permission[]> = {
  owner: PLATFORM_PERMISSIONS.admin.filter((p) => p !== 'projects:create' && p !== 'users:manage'),
  manager: PLATFORM_PERMISSIONS.product_manager.filter((p) => p !== 'projects:create'),
  developer: PLATFORM_PERMISSIONS.developer,
};

export function platformPermissions(role: UserRole | string): Permission[] {
  const perms = PLATFORM_PERMISSIONS[role as UserRole];
  return perms ? [...perms] : [...PLATFORM_PERMISSIONS.developer];
}

export function projectRolePermissions(role: ProjectMemberRole | string | null | undefined): Permission[] {
  if (!role) return [];
  const perms = PROJECT_ROLE_PERMISSIONS[role as ProjectMemberRole];
  return perms ? [...perms] : [];
}

/** Union of platform + project-member permissions (admin platform role = full). */
export function effectivePermissions(
  platformRole: UserRole | string,
  projectRole?: ProjectMemberRole | string | null
): Permission[] {
  if (platformRole === 'admin') {
    return [...PLATFORM_PERMISSIONS.admin];
  }
  const set = new Set<Permission>([
    ...platformPermissions(platformRole),
    ...projectRolePermissions(projectRole),
  ]);
  return [...set];
}

export function hasPermission(
  permissions: readonly Permission[] | undefined,
  required: Permission | Permission[]
): boolean {
  if (!permissions?.length) return false;
  const need = Array.isArray(required) ? required : [required];
  return need.every((p) => permissions.includes(p));
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  product_manager: 'Product Manager',
  developer: 'Developer',
  owner: 'Owner',
  manager: 'Manager',
};
