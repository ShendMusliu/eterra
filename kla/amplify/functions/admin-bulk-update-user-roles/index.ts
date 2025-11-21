import type { Handler } from "aws-lambda";
import type { Schema } from "../../data/resource";

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/admin-bulk-update-user-roles";
import { CognitoIdentityProviderClient, AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";

type BulkAction = "ADD" | "REMOVE";

type BulkArgs = {
  primaryEmails: string[];
  roles: string[];
  action: BulkAction;
};

type BulkFailure = {
  primaryEmail: string;
  reason: string;
};

type BulkSuccess = {
  primaryEmail: string;
  roles: string[];
};

type AppSyncEvent = {
  arguments?: BulkArgs;
  identity?: {
    sub?: string;
    username?: string;
    claims?: Record<string, unknown>;
  };
};

type RoleAssignment = Schema["UserRoleAssignment"]["type"];

const dataEnv = {
  ...env,
  AMPLIFY_DATA_DEFAULT_NAME:
    process.env.AMPLIFY_DATA_DEFAULT_NAME ?? env.AMPLIFY_DATA_DEFAULT_NAME ?? "",
};

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(dataEnv as any);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

const userPoolId = env.USER_POOL_ID ?? process.env.USER_POOL_ID ?? "";
const cognito =
  userPoolId.length > 0 ? new CognitoIdentityProviderClient({}) : null;

export const handler: Handler = async (event: AppSyncEvent) => {
  const input = event.arguments;
  if (!input) {
    throw new Error("Missing mutation arguments.");
  }

  const emails = normalizeEmailList(input.primaryEmails);
  if (!emails.length) {
    throw new Error("At least one primary email must be provided.");
  }

  const action = normalizeAction(input.action);
  const roles = normalizeRoles(input.roles);
  if (!roles.length) {
    throw new Error("At least one role must be supplied.");
  }

  const { sub: actorSub, email: actorEmail } = await resolveActorIdentity(event.identity);

  const failures: BulkFailure[] = [];
  const successes: BulkSuccess[] = [];

  for (const primaryEmail of emails) {
    try {
      const existing = await getAssignmentByPrimaryEmail(primaryEmail);
      if (!existing) {
        failures.push({
          primaryEmail,
          reason: "User role assignment not found.",
        });
        continue;
      }

      const currentRoles = normalizeRoles(existing.roles ?? []);
      let nextRoles: string[];
      if (action === "ADD") {
        nextRoles = mergeRoles(currentRoles, roles);
      } else {
        nextRoles = removeRoles(currentRoles, roles);
      }

      const updateInput = {
        id: existing.id,
        primaryEmail: existing.primaryEmail ?? primaryEmail,
        primaryEmailLower: existing.primaryEmailLower ?? primaryEmail,
        roles: nextRoles,
        ...(actorSub ? { updatedBySub: actorSub } : {}),
        ...(actorEmail ? { updatedByEmail: actorEmail } : {}),
      };

      const { data: updated, errors: updateErrors } =
        await client.models.UserRoleAssignment.update(updateInput);
      if (updateErrors?.length) {
        throw new Error(combineMessages(updateErrors));
      }
      if (!updated) {
        throw new Error("Failed to update record.");
      }
      successes.push({
        primaryEmail,
        roles: normalizeRoles(updated.roles ?? []),
      });
    } catch (error) {
      failures.push({
        primaryEmail,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    updatedCount: successes.length,
    failedCount: failures.length,
    successes,
    failures,
  };
};

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function normalizeEmailList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const deduped = new Set<string>();
  for (const value of values) {
    const email = normalizeEmail(value);
    if (email) {
      deduped.add(email);
    }
  }
  return Array.from(deduped);
}

function normalizeAction(value: unknown): BulkAction {
  if (value === "REMOVE") return "REMOVE";
  return "ADD";
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

function mergeRoles(current: string[], incoming: string[]): string[] {
  const set = new Set(current);
  for (const role of incoming) {
    set.add(role);
  }
  return Array.from(set);
}

function removeRoles(current: string[], toRemove: string[]): string[] {
  const removal = new Set(toRemove);
  return current.filter((role) => !removal.has(role));
}

function combineMessages(errors: Array<{ message?: string }>): string {
  return errors.map((error) => error.message ?? "Unknown error").join(", ");
}

async function getAssignmentByPrimaryEmail(primaryEmail: string): Promise<RoleAssignment | null> {
  const { data, errors } = await client.models.UserRoleAssignment.list({
    filter: { primaryEmailLower: { eq: primaryEmail } },
    limit: 2,
  });
  if (errors?.length) {
    throw new Error(combineMessages(errors));
  }
  return data?.[0] ?? null;
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
  const actorSub =
    pickFirstString([
      identity?.sub,
      stringClaim(claims.sub),
      identity?.username,
      stringClaim(claims["cognito:username"]),
    ]) ?? "";
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
      console.warn(
        "admin-bulk-update-user-roles: failed to resolve actor email from Cognito",
        error
      );
    }
  }

  return {
    sub: actorSub,
    email: actorEmail ?? "",
  };
}
