export const USER_ROLES = [
  "Admin",
  "Staff",
  "Teacher",
  "Student",
  "Parent",
  "IT",
  "ITAdmins",
  "HR",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export const USER_ROLES_SET = new Set<string>(USER_ROLES);
