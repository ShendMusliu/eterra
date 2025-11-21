import type { Handler } from "aws-lambda";
import type { Schema } from "../../data/resource";

import { randomUUID } from "node:crypto";

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/admin-sync-cognito-users";
import {
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";

type AppSyncEvent = {
  identity?: {
    sub?: string;
    username?: string;
    claims?: Record<string, unknown>;
  };
};

type SyncFailure = {
  email?: string;
  reason: string;
};

type SyncResult = {
  createdCount: number;
  skippedCount: number;
  missingEmailCount: number;
  failedCount: number;
  totalCognitoUsers: number;
  totalAssignmentsBefore: number;
  totalAssignmentsAfter: number;
  failures: SyncFailure[];
};

const MAX_FAILURES_TO_RETURN = 25;
const COGNITO_SYNC_STATE_ID = "COGNITO_SYNC_STATE";

const defaultDataName =
  process.env.AMPLIFY_DATA_DEFAULT_NAME ??
  (typeof env === "object" && env && "AMPLIFY_DATA_DEFAULT_NAME" in env
    ? (env as Record<string, string | undefined>).AMPLIFY_DATA_DEFAULT_NAME ?? ""
    : "");

const dataEnv = {
  ...env,
  ...(defaultDataName ? { AMPLIFY_DATA_DEFAULT_NAME: defaultDataName } : {}),
};

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(dataEnv as any);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

const userPoolId = env.USER_POOL_ID ?? process.env.USER_POOL_ID ?? "";
const cognito =
  userPoolId.length > 0
    ? new CognitoIdentityProviderClient({})
    : null;

export const handler: Handler = async (event: AppSyncEvent) => {
  if (!cognito || !userPoolId) {
    throw new Error("Cognito user pool is not configured for sync.");
  }

  const actor = await resolveActorIdentity(event.identity);
  const existingEmails = await loadExistingEmails();
  const totalAssignmentsBefore = existingEmails.size;

  let createdCount = 0;
  let skippedCount = 0;
  let missingEmailCount = 0;
  let failedCount = 0;
  let totalCognitoUsers = 0;
  const failures: SyncFailure[] = [];
  let paginationToken: string | undefined;
  const importNote = `Imported from Cognito on ${new Date().toISOString().slice(0, 10)}`;

  do {
    const response = await cognito.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        PaginationToken: paginationToken,
        Limit: 60,
      })
    );
    paginationToken = response.PaginationToken ?? undefined;

    for (const user of response.Users ?? []) {
      totalCognitoUsers += 1;
      const emailAttr = user.Attributes?.find((attr) => attr.Name === "email")?.Value ?? "";
      const email = normalizeEmail(emailAttr || user.Username || "");
      if (!email) {
        missingEmailCount += 1;
        continue;
      }

      if (existingEmails.has(email)) {
        skippedCount += 1;
        continue;
      }

      try {
        const createInput = {
          id: randomUUID(),
          primaryEmail: email,
          primaryEmailLower: email,
          roles: [],
          notes: importNote,
          ...(actor.sub ? { updatedBySub: actor.sub } : {}),
          ...(actor.email ? { updatedByEmail: actor.email } : {}),
        };
        const { data, errors } = await client.models.UserRoleAssignment.create(createInput);
        if (errors?.length) {
          throw new Error(
            errors
              .map((errorItem: { message?: string }) => errorItem?.message ?? "Unknown error")
              .join(", ")
          );
        }
        if (!data?.primaryEmail) {
          throw new Error("Create operation did not return a record.");
        }

        existingEmails.add(email);
        createdCount += 1;
      } catch (error: unknown) {
        failedCount += 1;
        if (failures.length < MAX_FAILURES_TO_RETURN) {
          failures.push({ email, reason: toErrorMessage(error, "Failed to create assignment.") });
        }
      }
    }
  } while (paginationToken);

  const result: SyncResult = {
    createdCount,
    skippedCount,
    missingEmailCount,
    failedCount,
    totalCognitoUsers,
    totalAssignmentsBefore,
    totalAssignmentsAfter: existingEmails.size,
    failures,
  };

  await recordSyncState(actor);

  return result;
};

type ListAssignmentsResult = Awaited<
  ReturnType<(typeof client)["models"]["UserRoleAssignment"]["list"]>
>;

async function loadExistingEmails() {
  const emails = new Set<string>();
  let nextToken: string | null | undefined = null;

  do {
    const listResponse: ListAssignmentsResult =
      (await client.models.UserRoleAssignment.list({
        limit: 200,
        nextToken: nextToken ?? undefined,
      })) as ListAssignmentsResult;
    const { data, errors, nextToken: nextPageToken } = listResponse;
    if (errors?.length) {
      throw new Error(
        errors
          .map((errorItem: { message?: string }) => errorItem?.message ?? "Unknown error")
          .join(", ")
      );
    }

    for (const item of data ?? []) {
      if (!item?.primaryEmail) continue;
      const normalized = normalizeEmail(item.primaryEmail);
      if (normalized) {
        emails.add(normalized);
      }
    }

    nextToken = nextPageToken ?? null;
  } while (nextToken);

  return emails;
}

async function recordSyncState(actor: { sub: string; email: string }) {
  const timestamp = new Date().toISOString();

  try {
    const existing = await client.models.CognitoSyncState.get({
      id: COGNITO_SYNC_STATE_ID,
    });

    if (!existing.errors?.length && existing.data) {
      const updateAttempt = await client.models.CognitoSyncState.update({
        id: COGNITO_SYNC_STATE_ID,
        lastRunAt: timestamp,
        ...(actor.sub ? { updatedBySub: actor.sub } : {}),
        ...(actor.email ? { updatedByEmail: actor.email } : {}),
      });
      if (updateAttempt.errors?.length) {
        throw new Error(
          updateAttempt.errors
            .map((error: { message?: string }) => error?.message ?? "Unknown error")
            .join(", ")
        );
      }
      return;
    }

    const createAttempt = await client.models.CognitoSyncState.create({
      id: COGNITO_SYNC_STATE_ID,
      lastRunAt: timestamp,
      ...(actor.sub ? { updatedBySub: actor.sub } : {}),
      ...(actor.email ? { updatedByEmail: actor.email } : {}),
    });
    if (createAttempt.errors?.length) {
      throw new Error(
        createAttempt.errors
          .map((error: { message?: string }) => error?.message ?? "Unknown error")
          .join(", ")
      );
    }
  } catch (error) {
    console.warn("admin-sync-cognito-users: failed to record sync state", error);
  }
}

async function resolveActorIdentity(identity: AppSyncEvent["identity"]) {
  const claims = identity?.claims ?? {};
  const sub =
    pickFirstString([
      identity?.sub,
      stringClaim(claims.sub),
      identity?.username,
      stringClaim(claims["cognito:username"]),
    ]) ?? "";
  let email = normalizeEmail(stringClaim(claims.email));

  if (!email && cognito && userPoolId && sub) {
    const username = identity?.username || sub;
    try {
      const response = await cognito.send(
        new AdminGetUserCommand({
          UserPoolId: userPoolId,
          Username: username,
        })
      );
      const emailAttr = response.UserAttributes?.find((attr) => attr.Name === "email");
      if (emailAttr?.Value) {
        email = normalizeEmail(emailAttr.Value);
      }
    } catch (error) {
      console.warn("admin-sync-cognito-users: failed to resolve actor email from Cognito", error);
    }
  }

  return { sub, email };
}

function normalizeEmail(input?: string | null) {
  return typeof input === "string" ? input.trim().toLowerCase() : "";
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  return fallback;
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
