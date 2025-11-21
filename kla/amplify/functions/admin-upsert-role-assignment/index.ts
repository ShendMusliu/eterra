import type { Handler } from "aws-lambda";
import type { Schema } from "../../data/resource";

import { randomUUID } from "node:crypto";

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/admin-upsert-role-assignment";
import { CognitoIdentityProviderClient, AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";

type UpsertArgs = {
  userId?: string | null;
  primaryEmail: string;
  roles: string[];
  verifiedEmails?: string[] | null;
  cognitoSub?: string | null;
  notes?: string | null;
};

type AppSyncEvent = {
  arguments?: UpsertArgs;
  identity?: {
    sub?: string;
    username?: string;
    claims?: Record<string, unknown>;
  };
};

type RoleAssignment = Schema["UserRoleAssignment"]["type"];

const dataEnv = {
  ...env,
  AMPLIFY_DATA_DEFAULT_NAME: process.env.AMPLIFY_DATA_DEFAULT_NAME ?? env.AMPLIFY_DATA_DEFAULT_NAME ?? "",
};

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(dataEnv);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

const userPoolId = env.USER_POOL_ID ?? process.env.USER_POOL_ID ?? "";
const cognito =
  userPoolId.length > 0
    ? new CognitoIdentityProviderClient({})
    : null;

export const handler: Handler = async (event: AppSyncEvent) => {
  const input = event.arguments;
  if (!input) {
    throw new Error("Missing mutation arguments.");
  }

  const userId = normalizeUserId(input.userId);
  const primaryEmail = normalizeEmail(input.primaryEmail);
  if (!primaryEmail) {
    throw new Error("primaryEmail is required.");
  }
  const primaryEmailLower = primaryEmail;

  const roles = normalizeRoles(input.roles);
  if (!roles.length) {
    throw new Error("At least one valid role is required.");
  }

  const hasVerifiedEmails = Object.prototype.hasOwnProperty.call(input, "verifiedEmails");
  const verifiedEmails = hasVerifiedEmails ? normalizeVerifiedEmails(input.verifiedEmails, primaryEmail) : undefined;
  const hasCognitoSub = Object.prototype.hasOwnProperty.call(input, "cognitoSub");
  const normalizedCognitoSub = hasCognitoSub ? normalizeSub(input.cognitoSub) : undefined;
  const hasNotes = Object.prototype.hasOwnProperty.call(input, "notes");
  const notes = hasNotes ? normalizeNotes(input.notes) : undefined;

  const { sub: actorSub, email: actorEmail } = await resolveActorIdentity(event.identity);
  const auditFields = {
    ...(actorSub ? { updatedBySub: actorSub } : {}),
    ...(actorEmail ? { updatedByEmail: actorEmail } : {}),
  };

  let existing = userId ? await getAssignmentById(userId) : null;

  if (!existing) {
    existing = await getAssignmentByPrimaryEmailLower(primaryEmailLower);
  }

  if (!existing && normalizedCognitoSub) {
    existing = await getAssignmentByCognitoSub(normalizedCognitoSub);
  }

  await assertUniquePrimaryEmail(primaryEmailLower, existing?.id);
  if (normalizedCognitoSub) {
    await assertUniqueCognitoSub(normalizedCognitoSub, existing?.id);
  }

  const recordId = existing?.id ?? userId ?? randomUUID();

  if (existing) {
    const updateInput = {
      id: recordId,
      primaryEmail,
      primaryEmailLower,
      roles,
      ...(verifiedEmails !== undefined ? { verifiedEmails } : {}),
      ...(hasCognitoSub ? { cognitoSub: normalizedCognitoSub ?? null } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...auditFields,
    };

    const { data, errors } = await client.models.UserRoleAssignment.update(updateInput);
    if (errors?.length) {
      throw new Error(errors.map((e) => e.message).join(", "));
    }
    return data;
  }

  const createInput = {
    id: recordId,
    primaryEmail,
    primaryEmailLower,
    roles,
    ...(verifiedEmails !== undefined ? { verifiedEmails } : {}),
    ...(hasCognitoSub ? { cognitoSub: normalizedCognitoSub ?? null } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...auditFields,
  };

  const { data, errors } = await client.models.UserRoleAssignment.create(createInput);
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }
  return data;
};

async function getAssignmentById(id: string): Promise<RoleAssignment | null> {
  const { data, errors } = await client.models.UserRoleAssignment.get({ id });
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }
  return data ?? null;
}

async function getAssignmentByPrimaryEmailLower(primaryEmailLower: string): Promise<RoleAssignment | null> {
  const { data, errors } = await client.models.UserRoleAssignment.list({
    filter: { primaryEmailLower: { eq: primaryEmailLower } },
    limit: 2,
  });
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }
  return data?.[0] ?? null;
}

async function getAssignmentByCognitoSub(cognitoSub: string): Promise<RoleAssignment | null> {
  const { data, errors } = await client.models.UserRoleAssignment.list({
    filter: { cognitoSub: { eq: cognitoSub } },
    limit: 2,
  });
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }
  return data?.[0] ?? null;
}

async function assertUniquePrimaryEmail(primaryEmailLower: string, currentId?: string) {
  const { data, errors } = await client.models.UserRoleAssignment.list({
    filter: { primaryEmailLower: { eq: primaryEmailLower } },
    limit: 5,
  });
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }
  const conflict = (data ?? []).find((item) => item?.id && item.id !== currentId);
  if (conflict) {
    throw new Error("Another account already uses this primary email.");
  }
}

async function assertUniqueCognitoSub(cognitoSub: string, currentId?: string) {
  const { data, errors } = await client.models.UserRoleAssignment.list({
    filter: { cognitoSub: { eq: cognitoSub } },
    limit: 5,
  });
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }
  const conflict = (data ?? []).find((item) => item?.id && item.id !== currentId);
  if (conflict) {
    throw new Error("Another account is already linked to this Cognito user.");
  }
}

function normalizeUserId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[0-9a-fA-F-]{10,}$/.test(trimmed)) {
    throw new Error("userId must be a UUID-like string.");
  }
  return trimmed;
}

function normalizeEmail(value?: string | null): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function normalizeRoles(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const validRoles: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (!/^[A-Za-z0-9_+=,.@-]{1,128}$/.test(trimmed)) {
      throw new Error(`Invalid role name: ${trimmed}`);
    }
    if (!validRoles.includes(trimmed)) {
      validRoles.push(trimmed);
    }
  }
  return validRoles;
}

function normalizeVerifiedEmails(values: unknown, primary: string): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const normalized = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const email = normalizeEmail(value);
    if (!email || email === primary) continue;
    normalized.add(email);
  }
  return Array.from(normalized);
}

function normalizeSub(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[0-9a-fA-F-]{10,}$/.test(trimmed)) {
    throw new Error("cognitoSub must be a UUID-like string.");
  }
  return trimmed;
}

function normalizeNotes(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function stringClaim(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function pickFirstString(values: Array<string | undefined | null>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

async function resolveActorIdentity(identity: AppSyncEvent["identity"]) {
  const claims = identity?.claims ?? {};
  const actorSub = pickFirstString([identity?.sub, stringClaim(claims.sub), identity?.username, stringClaim(claims["cognito:username"])]) ?? "";
  let actorEmail = stringClaim(claims.email);
  if (actorEmail) {
    actorEmail = normalizeEmail(actorEmail);
  }

  if (!actorEmail && cognito && userPoolId && actorSub) {
    const username = identity?.username || actorSub;
    try {
      const response = await cognito.send(
        new AdminGetUserCommand({
          UserPoolId: userPoolId,
          Username: username,
        })
      );
      const emailAttr = response.UserAttributes?.find((attr) => attr.Name === "email");
      if (emailAttr?.Value) {
        actorEmail = normalizeEmail(emailAttr.Value);
      }
    } catch (error) {
      console.warn("admin-upsert-role-assignment: failed to resolve actor email from Cognito", error);
    }
  }

  return {
    sub: actorSub,
    email: actorEmail ?? "",
  };
}
