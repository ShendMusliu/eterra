import type { Handler } from "aws-lambda";
import type { Schema } from "../../data/resource";

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/admin-delete-user-role-assignments";

type DeleteArgs = {
  primaryEmails: string[];
};

type DeleteFailure = {
  primaryEmail: string;
  reason: string;
};

type DeleteSuccess = {
  primaryEmail: string;
};

type AppSyncEvent = {
  arguments?: DeleteArgs;
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

export const handler: Handler = async (event: AppSyncEvent) => {
  const input = event.arguments;
  if (!input) {
    throw new Error("Missing mutation arguments.");
  }

  const emails = normalizeEmailList(input.primaryEmails);
  if (!emails.length) {
    throw new Error("At least one primary email must be provided.");
  }

  const failures: DeleteFailure[] = [];
  const successes: DeleteSuccess[] = [];

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

      const { errors: deleteErrors } = await client.models.UserRoleAssignment.delete(
        { id: existing.id },
      );
      if (deleteErrors?.length) {
        throw new Error(combineMessages(deleteErrors));
      }
      successes.push({ primaryEmail });
    } catch (error) {
      failures.push({
        primaryEmail,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    deletedCount: successes.length,
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

function combineMessages(errors: Array<{ message?: string }>): string {
  return errors.map((error) => error.message ?? "Unknown error").join(", ");
}

async function getAssignmentByPrimaryEmail(primaryEmail: string): Promise<RoleAssignment | null> {
  let nextToken: string | null | undefined = null;

  do {
    type ListResponse = Awaited<
      ReturnType<(typeof client)["models"]["UserRoleAssignment"]["list"]>
    >;
    const response: ListResponse = await client.models.UserRoleAssignment.list({
      filter: { primaryEmailLower: { eq: primaryEmail } },
      limit: 100,
      nextToken: nextToken ?? undefined,
    });
    if (response.errors?.length) {
      throw new Error(combineMessages(response.errors));
    }
    const data = (response.data ?? []) as RoleAssignment[];
    const match = data.find((item) => {
      const candidate = normalizeEmail(item.primaryEmailLower ?? item.primaryEmail);
      return candidate === primaryEmail;
    });
    if (match) {
      return match;
    }
    nextToken = response.nextToken ?? null;
  } while (nextToken);

  return null;
}
