import type { Handler } from "aws-lambda";
import type { Schema } from "../../data/resource";

import { randomUUID } from "node:crypto";

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/admin-import-user-accounts";
import { CognitoIdentityProviderClient, AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";

type ImportArgs = {
  csv: string;
};

type AppSyncEvent = {
  arguments?: ImportArgs;
  identity?: {
    sub?: string;
    username?: string;
    claims?: Record<string, unknown>;
  };
};

type ImportRow = {
  rowNumber: number;
  primaryEmail: string;
  roles: string[];
  notes?: string | null;
};

type ImportError = {
  rowNumber: number;
  message: string;
};

type RoleAssignment = Schema["UserRoleAssignment"]["type"];
type AssignmentMap = Map<string, RoleAssignment>;

const defaultDataName =
  process.env.AMPLIFY_DATA_DEFAULT_NAME ??
  (typeof env === "object" && env && "AMPLIFY_DATA_DEFAULT_NAME" in env ? (env as Record<string, string | undefined>).AMPLIFY_DATA_DEFAULT_NAME ?? "" : "");

const dataEnv = {
  ...env,
  ...(defaultDataName ? { AMPLIFY_DATA_DEFAULT_NAME: defaultDataName } : {}),
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
  const csv = event.arguments?.csv ?? "";
  if (!csv.trim()) {
    throw new Error("CSV content is required.");
  }

  const actor = await resolveActorIdentity(event.identity);

  const parseResult = parseCsv(csv);
  if (parseResult.errors.length && parseResult.rows.length === 0) {
    const combined = parseResult.errors.map((err) => `Row ${err.rowNumber}: ${err.message}`).join("\n");
    throw new Error(`Unable to import CSV:\n${combined}`);
  }

  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = parseResult.errors.length;
  const errorMessages: string[] = parseResult.errors.map((err) => `Row ${err.rowNumber}: ${err.message}`);

  const assignmentMap = await loadAssignmentMap();

  for (const row of parseResult.rows) {
    try {
      const existing = assignmentMap.get(row.primaryEmail) ?? null;

      if (existing) {
        const updateInput = {
          id: existing.id,
          primaryEmail: row.primaryEmail,
          primaryEmailLower: row.primaryEmail,
          roles: row.roles,
          notes: row.notes ?? undefined,
          ...(actor.sub ? { updatedBySub: actor.sub } : {}),
          ...(actor.email ? { updatedByEmail: actor.email } : {}),
        };
        const { data, errors } = await client.models.UserRoleAssignment.update(updateInput);
        if (errors?.length) {
          throw new Error(errors.map((error) => error.message).join(", "));
        }
        if (data) {
          assignmentMap.set(row.primaryEmail, data);
        }
        updatedCount += 1;
        continue;
      }

      const createInput = {
        id: randomUUID(),
        primaryEmail: row.primaryEmail,
        primaryEmailLower: row.primaryEmail,
        roles: row.roles,
        notes: row.notes ?? undefined,
        ...(actor.sub ? { updatedBySub: actor.sub } : {}),
        ...(actor.email ? { updatedByEmail: actor.email } : {}),
      };
      const { data, errors } = await client.models.UserRoleAssignment.create(createInput);
      if (errors?.length) {
        throw new Error(errors.map((error) => error.message).join(", "));
      }
      if (data) {
        assignmentMap.set(row.primaryEmail, data);
      }
      createdCount += 1;
    } catch (error: unknown) {
      errorCount += 1;
      errorMessages.push(`Row ${row.rowNumber}: ${toErrorMessage(error, "Unexpected error while processing row.")}`);
    }
  }

  const summaryLines = [
    `Processed ${parseResult.rows.length} row${parseResult.rows.length === 1 ? "" : "s"}.`,
    `Created: ${createdCount}`,
    `Updated: ${updatedCount}`,
    `Errors: ${errorCount}`,
  ];

  if (errorMessages.length > 0) {
    summaryLines.push("Error details:");
    summaryLines.push(...errorMessages);
  }

  return summaryLines.join("\n");
};

async function loadAssignmentMap(): Promise<AssignmentMap> {
  const map: AssignmentMap = new Map();
  let nextToken: string | null = null;

  do {
    type ListResponse = Awaited<
      ReturnType<(typeof client)["models"]["UserRoleAssignment"]["list"]>
    >;
    const response: ListResponse = await client.models.UserRoleAssignment.list({
      limit: 200,
      nextToken: nextToken ?? undefined,
    });
    if (response.errors?.length) {
      throw new Error(response.errors.map((error) => error.message).join(", "));
    }
    const items = (response.data ?? []) as Array<RoleAssignment | null>;
    for (const item of items) {
      if (!item) continue;
      const key = normalizeEmail(item.primaryEmailLower ?? item.primaryEmail ?? "");
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, item);
        continue;
      }
      const existing = map.get(key);
      if (existing) {
        map.set(key, pickLatestAssignment(existing, item));
      }
    }
    nextToken = response.nextToken ?? null;
  } while (nextToken);

  return map;
}

function pickLatestAssignment(a: RoleAssignment, b: RoleAssignment): RoleAssignment {
  const timestamp = (item: RoleAssignment) => {
    const candidate = item.updatedAt ?? item.createdAt ?? "";
    const value = Date.parse(candidate);
    return Number.isNaN(value) ? 0 : value;
  };
  return timestamp(b) >= timestamp(a) ? b : a;
}

function parseCsv(csv: string) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { rows: [] as ImportRow[], errors: [{ rowNumber: 0, message: "CSV file is empty." }] as ImportError[] };
  }

  const headerTokens = splitCsvLine(lines[0]).map((token) => token.trim().toLowerCase());
  const requiredColumns: Array<"primaryemail" | "roles"> = ["primaryemail", "roles"];
  for (const column of requiredColumns) {
    if (!headerTokens.includes(column)) {
      return {
        rows: [] as ImportRow[],
        errors: [{ rowNumber: 0, message: `Missing required column '${column}'.` }],
      };
    }
  }

  const notesIndex = headerTokens.indexOf("notes");
  const emailIndex = headerTokens.indexOf("primaryemail");
  const rolesIndex = headerTokens.indexOf("roles");

  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const rawTokens = splitCsvLine(lines[i]);
    if (rawTokens.every((token) => token.trim().length === 0)) {
      continue;
    }

    const primaryEmail = normalizeEmail(rawTokens[emailIndex] ?? "");
    if (!primaryEmail) {
      errors.push({ rowNumber, message: "primaryEmail is required." });
      continue;
    }
    if (!isValidEmail(primaryEmail)) {
      errors.push({ rowNumber, message: "primaryEmail must be a valid email address." });
      continue;
    }

    const rolesRaw = rawTokens[rolesIndex] ?? "";
    let roles: string[];
    try {
      roles = normalizeRoles(rolesRaw);
    } catch (error: unknown) {
      errors.push({ rowNumber, message: toErrorMessage(error, "Invalid role value.") });
      continue;
    }
    if (!roles.length) {
      errors.push({ rowNumber, message: "At least one role is required." });
      continue;
    }

    const notesRaw = notesIndex >= 0 ? rawTokens[notesIndex] ?? "" : "";
    const notes = notesRaw.trim().length > 0 ? notesRaw.trim() : null;

    rows.push({
      rowNumber,
      primaryEmail,
      roles,
      notes,
    });
  }

  return { rows, errors };
}

function splitCsvLine(line: string) {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      tokens.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || line.endsWith(",")) {
    tokens.push(current.trim());
  }

  return tokens;
}

function normalizeRoles(input: string) {
  if (typeof input !== "string") return [] as string[];
  const tokens = input
    .split(/[\s,;\n]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const valid: string[] = [];
  for (const token of tokens) {
    if (!/^[A-Za-z0-9_+=,.@-]{1,128}$/.test(token)) {
      throw new Error(`Invalid role name: ${token}`);
    }
    if (!valid.includes(token)) {
      valid.push(token);
    }
  }
  return valid;
}

function normalizeEmail(value: string): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

async function resolveActorIdentity(identity: AppSyncEvent["identity"]) {
  const claims = identity?.claims ?? {};
  const sub = pickFirstString([identity?.sub, stringClaim(claims.sub), identity?.username, stringClaim(claims["cognito:username"])]) ?? "";
  let email = stringClaim(claims.email);
  if (email) {
    email = normalizeEmail(email);
  }

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
      console.warn("admin-import-user-accounts: failed to resolve actor email from Cognito", error);
    }
  }

  return { sub, email: email ?? "" };
}
