import { USER_ROLES, USER_ROLES_SET, type UserRole } from "./userRoles";

export const APP_PERMISSIONS = [
  "dashboard.view",
  "deviceLoan.request",
  "deviceLoan.manage",
  "pcLab.request",
  "pcLab.manage",
  "sportsField.request",
  "sportsField.manage",
  "roleAssignments.manage",
  "studentProfiles.manage",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

type RolePermissionMap = Record<UserRole, readonly AppPermission[]>;

export const ROLE_PERMISSIONS: RolePermissionMap = {
  Admin: [...APP_PERMISSIONS],
  Staff: ["dashboard.view", "deviceLoan.request", "pcLab.request", "sportsField.request"],
  Teacher: ["dashboard.view", "deviceLoan.request", "pcLab.request", "sportsField.request"],
  Student: ["dashboard.view", "deviceLoan.request", "sportsField.request"],
  Parent: ["dashboard.view", "sportsField.request"],
  IT: ["dashboard.view", "deviceLoan.manage", "pcLab.manage"],
  ITAdmins: [
    "dashboard.view",
    "deviceLoan.request",
    "deviceLoan.manage",
    "pcLab.request",
    "pcLab.manage",
    "sportsField.request",
  ],
  HR: ["dashboard.view", "sportsField.manage", "studentProfiles.manage"],
};

export const VALID_PERMISSIONS_SET = new Set<AppPermission>(APP_PERMISSIONS);

export function getPermissionsForRole(role: UserRole): readonly AppPermission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function getPermissionsForRoles(roles: readonly UserRole[]): AppPermission[] {
  const perms = new Set<AppPermission>();
  for (const role of roles) {
    const mapped = ROLE_PERMISSIONS[role];
    if (!mapped) continue;
    mapped.forEach((perm) => perms.add(perm));
  }
  return Array.from(perms);
}

export function isValidRoleName(value: string): value is UserRole {
  return USER_ROLES_SET.has(value);
}

export function normalizeRoleName(value: string): UserRole | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isValidRoleName(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const match = USER_ROLES.find((role) => role.toLowerCase() === lower);
  return match ?? null;
}
