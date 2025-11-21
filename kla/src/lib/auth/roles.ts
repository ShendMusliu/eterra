import type { FetchAuthSessionOutput } from "aws-amplify/auth";
import { USER_ROLES, USER_ROLES_SET, type UserRole } from "../../../shared/userRoles";
import {
  getPermissionsForRoles,
  normalizeRoleName,
  type AppPermission,
} from "../../../shared/accessControl";

type TokenPayload = Record<string, unknown> | undefined;

const ROLE_ALIAS_LOOKUP: Record<string, UserRole> = USER_ROLES.reduce((acc, role) => {
  acc[role.toLowerCase()] = role;
  acc[role] = role;
  return acc;
}, {} as Record<string, UserRole>);

function parseClaim(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => (typeof entry === "string" ? entry.split(",") : []))
      .map((token) => token.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);
  }
  return [];
}

function parseJsonClaim(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}

function collectRawRoles(...payloads: (TokenPayload | undefined)[]): string[] {
  const all: string[] = [];
  for (const payload of payloads) {
    if (!payload) continue;
    all.push(
      ...parseClaim(payload["cognito:groups"]),
      ...parseClaim(payload["app_roles"]),
      ...parseJsonClaim(payload["app_roles_json"])
    );
  }
  return all;
}

export function normalizeRoles(rawRoles: readonly string[]): UserRole[] {
  const seen = new Set<UserRole>();
  for (const role of rawRoles) {
    const candidate = ROLE_ALIAS_LOOKUP[role] ?? normalizeRoleName(role);
    if (!candidate) continue;
    if (USER_ROLES_SET.has(candidate)) {
      seen.add(candidate);
    }
  }
  return Array.from(seen);
}

export function extractRolesFromSession(session: FetchAuthSessionOutput): UserRole[] {
  const idPayload = session.tokens?.idToken?.payload as TokenPayload;
  const accessPayload = session.tokens?.accessToken?.payload as TokenPayload;
  const raw = collectRawRoles(idPayload, accessPayload);
  return normalizeRoles(raw);
}

export function rolesToPermissions(roles: readonly UserRole[]): AppPermission[] {
  return getPermissionsForRoles(roles);
}
