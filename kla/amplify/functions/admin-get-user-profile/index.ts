import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import type { Handler } from "aws-lambda";
import { env } from "$amplify/env/admin-get-user-profile";

import type { Schema } from "../../data/resource";

type AppSyncEvent = {
  arguments?: {
    userId?: string | null;
  };
};

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

const USER_PK_PREFIX = "USER#";
const PROFILE_SK = "PROFILE";

export const handler: Handler = async (event: AppSyncEvent) => {
  const userId = normalizeId(event.arguments?.userId);
  if (!userId) {
    throw new Error("userId is required.");
  }

  const pk = buildPk(userId);
  const { data, errors } = await client.models.UserProfile.get({ pk, sk: PROFILE_SK });
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message ?? "Unknown error").join(", "));
  }
  if (!data) {
    throw new Error("User profile not found.");
  }
  return data;
};

function normalizeId(value?: string | null): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!/^[0-9a-fA-F-]{10,}$/.test(trimmed)) {
    throw new Error("userId must be a UUID-like string.");
  }
  return trimmed;
}

function buildPk(userId: string) {
  return `${USER_PK_PREFIX}${userId}`;
}
