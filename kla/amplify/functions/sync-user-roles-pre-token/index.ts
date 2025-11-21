import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend-function/runtime";
import type { PreTokenGenerationTriggerHandler } from "aws-lambda";

import type { Schema } from "../../data/resource";
import { env } from "$amplify/env/sync-user-roles-pre-token";
import type { UserRole } from "../../../shared/userRoles";
import {
  getPermissionsForRoles,
  normalizeRoleName,
  type AppPermission,
} from "../../../shared/accessControl";

type RoleAssignment = Schema["UserRoleAssignment"]["type"];

const dataEnv = {
  ...env,
  AMPLIFY_DATA_DEFAULT_NAME: process.env.AMPLIFY_DATA_DEFAULT_NAME ?? env.AMPLIFY_DATA_DEFAULT_NAME ?? "",
};

let client: ReturnType<typeof generateClient<Schema>> | null = null;

async function ensureClient() {
  if (client) return client;
  try {
    const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(dataEnv);
    Amplify.configure(resourceConfig, libraryOptions);
    client = generateClient<Schema>();
    return client;
  } catch (error) {
    console.error("sync-user-roles-pre-token: failed to initialize data client", error);
    return null;
  }
}

export const handler: PreTokenGenerationTriggerHandler = async (event) => {
  const invocationCache = new Map<string, RoleAssignment | null>();
  try {
    const dataClient = await ensureClient();
    if (!dataClient) {
      return event;
    }

    const cognitoSub = normalizeSub(event.request.userAttributes?.sub ?? event.userName);
    const email = normalizeEmail(event.request.userAttributes?.email);
    if (!cognitoSub && !email) {
      console.warn("preTokenGeneration: missing sub and email", {
        userName: event.userName,
      });
      return event;
    }

    const assignment = await lookupAssignment(dataClient, { email, cognitoSub }, invocationCache);
    if (!assignment) {
      console.warn("preTokenGeneration: no role assignment found", { sub: cognitoSub });
      return event;
    }

    const normalizedRoles = normalizeRoles(assignment.roles ?? []);
    if (!normalizedRoles.length) {
      console.warn("preTokenGeneration: assignment has no roles", { sub: cognitoSub });
      return event;
    }

    const computedClaims = buildClaims(normalizedRoles);
    applyClaims(event, computedClaims);
  } catch (error) {
    console.error("preTokenGeneration: Failed to sync roles", error);
  }

  return event;
};

function applyClaims(
  event: Parameters<PreTokenGenerationTriggerHandler>[0],
  claims: { roles: UserRole[]; permissions: AppPermission[] }
) {
  const existingGroupOverrides = toArray(
    event.request.groupConfiguration?.groupsToOverride ||
      event.response?.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride
  );

  const groupsToApply = Array.from(new Set([...existingGroupOverrides, ...claims.roles]));

  event.response = event.response || {};
  event.response.claimsOverrideDetails = event.response.claimsOverrideDetails || {};
  event.response.claimsOverrideDetails.groupOverrideDetails = {
    groupsToOverride: groupsToApply,
  };

  const existingClaims = event.response.claimsOverrideDetails.claimsToAddOrOverride || {};
  event.response.claimsOverrideDetails.claimsToAddOrOverride = {
    ...existingClaims,
    app_roles: groupsToApply.join(","),
    app_roles_json: JSON.stringify(groupsToApply),
    app_permissions: claims.permissions.join(","),
    app_permissions_json: JSON.stringify(claims.permissions),
  };
}

async function lookupAssignment(
  dataClient: ReturnType<typeof generateClient<Schema>>,
  { email, cognitoSub }: { email?: string; cognitoSub?: string | null },
  cache: Map<string, RoleAssignment | null>
) {
  const cacheKey = cognitoSub ?? email ?? "";
  if (cacheKey && cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }

  const assignment = await findAssignment(dataClient, { email, cognitoSub });
  if (cacheKey) {
    cache.set(cacheKey, assignment);
  }
  return assignment;
}

async function findAssignment(
  dataClient: ReturnType<typeof generateClient<Schema>>,
  { email, cognitoSub }: { email?: string; cognitoSub?: string | null }
) {
  if (cognitoSub) {
    const bySub = await dataClient.models.UserRoleAssignment.list({
      filter: { cognitoSub: { eq: cognitoSub } },
      limit: 2,
    });
    if (bySub.errors?.length) {
      throw new Error(bySub.errors.map((e) => e.message).join(", "));
    }
    if (bySub.data?.[0]) {
      return bySub.data[0];
    }
  }

  if (!email) {
    return null;
  }

  const byEmail = await dataClient.models.UserRoleAssignment.list({
    filter: { primaryEmailLower: { eq: email } },
    limit: 2,
  });
  if (byEmail.errors?.length) {
    throw new Error(byEmail.errors.map((e) => e.message).join(", "));
  }
  if (byEmail.data?.[0]) {
    return byEmail.data[0];
  }

  const aliasRes = await dataClient.models.UserRoleAssignment.list({
    filter: { verifiedEmails: { contains: email } },
    limit: 25,
  });
  if (aliasRes.errors?.length) {
    throw new Error(aliasRes.errors.map((e) => e.message).join(", "));
  }

  return aliasRes.data?.[0] ?? null;
}

function buildClaims(roles: UserRole[]): { roles: UserRole[]; permissions: AppPermission[] } {
  const normalizedRoles = Array.from(new Set(roles));
  const permissions = getPermissionsForRoles(normalizedRoles);
  return { roles: normalizedRoles, permissions };
}

function normalizeEmail(email?: string) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function normalizeSub(value?: string | null): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!/^[0-9a-fA-F-]{10,}$/.test(trimmed)) {
    return "";
  }
  return trimmed;
}

function normalizeRoles(roles: unknown[]): UserRole[] {
  if (!Array.isArray(roles)) return [];
  const seen = new Set<UserRole>();
  for (const role of roles) {
    if (typeof role !== "string") continue;
    const trimmed = role.trim();
    if (!trimmed) continue;
    const normalized = normalizeRoleName(trimmed);
    if (normalized) {
      seen.add(normalized);
    }
  }
  return Array.from(seen);
}

function toArray(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof input === "string" && input.trim().length > 0) {
    return [input.trim()];
  }
  return [];
}
