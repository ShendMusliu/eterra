import { randomUUID } from "node:crypto";
import type { Handler } from "aws-lambda";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";

import type { Schema } from "../../data/resource";
import { env } from "$amplify/env/user-role-import-worker";
import {
  parseUserRoleImportCsv,
  type UserRoleImportParseResult,
  type UserRoleImportRow,
} from "../../../shared/userRoleImport";

type WorkerEvent = {
  jobId?: string;
};

type UserRoleImportJob = Schema["UserRoleImportJob"]["type"];

const defaultDataName =
  process.env.AMPLIFY_DATA_DEFAULT_NAME ??
  (typeof env === "object" && env && "AMPLIFY_DATA_DEFAULT_NAME" in env
    ? (env as Record<string, string | undefined>).AMPLIFY_DATA_DEFAULT_NAME ?? ""
    : "");

const dataEnv = {
  ...env,
  ...(defaultDataName ? { AMPLIFY_DATA_DEFAULT_NAME: defaultDataName } : {}),
} satisfies Record<string, string | undefined>;

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(dataEnv);
Amplify.configure(resourceConfig, libraryOptions);

const dataClient = generateClient<Schema>();
const s3Client = new S3Client({});

const bucketName = env.IMPORT_BUCKET_NAME;
const prefix = env.IMPORT_BUCKET_PREFIX ?? "protected/admin/user-role-imports";

if (!bucketName) {
  throw new Error("IMPORT_BUCKET_NAME environment variable is missing.");
}

type JobUpdateInput = Parameters<(typeof dataClient)["models"]["UserRoleImportJob"]["update"]>[0];
type RoleAssignment = Schema["UserRoleAssignment"]["type"];
type AssignmentMap = Map<string, RoleAssignment>;

async function updateJob(values: JobUpdateInput) {
  const response = await dataClient.models.UserRoleImportJob.update(values);
  if (response.errors?.length) {
    console.error("Failed to update UserRoleImportJob", values.id, response.errors);
  }
  return response.data;
}

async function streamToString(stream: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>): Promise<string> {
  if (Symbol.asyncIterator in stream) {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  const reader = (stream as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function loadCsv(job: UserRoleImportJob) {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: job.csvS3Key,
    })
  );
  return streamToString(response.Body as AsyncIterable<Uint8Array>);
}

async function writeResults(jobId: string, data: unknown) {
  const key = `${prefix}/${jobId}/result.json`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json; charset=utf-8",
    })
  );
  return key;
}

function normalizeEmail(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

function pickLatestAssignment(a: RoleAssignment, b: RoleAssignment): RoleAssignment {
  const parseTime = (item: RoleAssignment) => {
    const candidate = item.updatedAt ?? item.createdAt ?? "";
    const value = Date.parse(candidate);
    return Number.isNaN(value) ? 0 : value;
  };
  return parseTime(b) >= parseTime(a) ? b : a;
}

async function loadAssignmentMap(): Promise<AssignmentMap> {
  const map: AssignmentMap = new Map();
  let nextToken: string | null = null;

  do {
    type ListResponse = Awaited<
      ReturnType<(typeof dataClient)["models"]["UserRoleAssignment"]["list"]>
    >;
    const response: ListResponse = await dataClient.models.UserRoleAssignment.list({
      limit: 200,
      nextToken: nextToken ?? undefined,
    });
    if (response.errors?.length) {
      throw new Error(response.errors.map((error) => error.message).join(", "));
    }
    const items = (response.data ?? []) as Array<RoleAssignment | null>;
    for (const item of items) {
      if (!item) continue;
      const key = normalizeEmail(item.primaryEmailLower ?? item.primaryEmail);
      if (!key) continue;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, item);
      } else {
        map.set(key, pickLatestAssignment(existing, item));
      }
    }
    nextToken = response.nextToken ?? null;
  } while (nextToken);

  return map;
}

type RowResult = {
  rowNumber: number;
  primaryEmail: string | null;
  status: "SUCCESS" | "ERROR";
  message?: string;
};

export const handler: Handler = async (event: WorkerEvent) => {
  const jobId = event?.jobId;
  if (!jobId) {
    throw new Error("jobId is required.");
  }

  const jobResponse = await dataClient.models.UserRoleImportJob.get(
    { id: jobId },
    { authMode: "iam" }
  );
  if (jobResponse.errors?.length) {
    throw new Error(jobResponse.errors.map((error) => error.message).join(", "));
  }
  const job = (jobResponse.data ?? null) as UserRoleImportJob | null;
  if (!job) {
    throw new Error(`UserRoleImportJob ${jobId} not found.`);
  }

  const nowIso = new Date().toISOString();
  await updateJob({
    id: jobId,
    status: "PROCESSING",
    message: "Processing user role import...",
    startedAt: job.startedAt ?? nowIso,
  });

  try {
    const csv = await loadCsv(job);
    const parseResult: UserRoleImportParseResult = parseUserRoleImportCsv(csv);
    const assignmentMap = await loadAssignmentMap();

    if (parseResult.errors.length && parseResult.rows.length === 0) {
      await updateJob({
        id: jobId,
        status: "FAILED",
        message: parseResult.errors.join("\n"),
        failureCount: parseResult.errors.length,
        processedRows: 0,
        totalRows: 0,
        completedAt: new Date().toISOString(),
        startedAt: job.startedAt ?? nowIso,
      });
      return;
    }

    const rowResults: RowResult[] = [];
    let processedRows = 0;
    let successCount = 0;
    let failureCount = parseResult.errors.length;

    const actionableRows = parseResult.rows.filter(
      (row: UserRoleImportRow) => row.errors.length === 0 && row.primaryEmail && row.roles.length > 0
    );

    for (const row of parseResult.rows) {
      if (row.errors.length > 0 || !row.primaryEmail || row.roles.length === 0) {
        failureCount += 1;
        processedRows += 1;
        rowResults.push({
          rowNumber: row.rowNumber,
          primaryEmail: row.primaryEmail,
          status: "ERROR",
          message: row.errors.length ? row.errors.join("; ") : "Invalid row data.",
        });
      }
    }

    await updateJob({
      id: jobId,
      status: "PROCESSING",
      totalRows: parseResult.rows.length,
      processedRows,
      successCount,
      failureCount,
      message: `Processing ${processedRows}/${parseResult.rows.length} rows...`,
      startedAt: job.startedAt ?? nowIso,
    });

    for (const row of actionableRows) {
      const primaryEmail = row.primaryEmail;
      if (!primaryEmail) {
        failureCount += 1;
        processedRows += 1;
        rowResults.push({
          rowNumber: row.rowNumber,
          primaryEmail: null,
          status: "ERROR",
          message: "Primary email missing after normalization.",
        });
        continue;
      }

      try {
        const existing = assignmentMap.get(primaryEmail) ?? null;

        if (existing) {
          const updateInput: Parameters<(typeof dataClient)["models"]["UserRoleAssignment"]["update"]>[0] = {
            id: existing.id,
            primaryEmail,
            primaryEmailLower: primaryEmail,
            roles: row.roles,
            notes: row.notes ?? undefined,
            ...(job.createdBySub ? { updatedBySub: job.createdBySub } : {}),
            ...(job.createdByEmail ? { updatedByEmail: job.createdByEmail } : {}),
          };
          const updateResult = await dataClient.models.UserRoleAssignment.update(updateInput, { authMode: "iam" });
          if (updateResult.errors?.length) {
            throw new Error(updateResult.errors.map((error) => error.message).join(", "));
          }
          assignmentMap.set(primaryEmail, (updateResult.data as RoleAssignment | undefined) ?? existing);
        } else {
          const createInput: Parameters<(typeof dataClient)["models"]["UserRoleAssignment"]["create"]>[0] = {
            id: randomUUID(),
            primaryEmail,
            primaryEmailLower: primaryEmail,
            roles: row.roles,
            notes: row.notes ?? undefined,
            ...(job.createdBySub ? { updatedBySub: job.createdBySub } : {}),
            ...(job.createdByEmail ? { updatedByEmail: job.createdByEmail } : {}),
          };
          const createResult = await dataClient.models.UserRoleAssignment.create(createInput, { authMode: "iam" });
          if (createResult.errors?.length) {
            throw new Error(createResult.errors.map((error) => error.message).join(", "));
          }
          if (createResult.data) {
            assignmentMap.set(primaryEmail, createResult.data as RoleAssignment);
          }
        }

        successCount += 1;
        processedRows += 1;
        rowResults.push({
          rowNumber: row.rowNumber,
          primaryEmail,
          status: "SUCCESS",
        });
      } catch (error) {
        failureCount += 1;
        processedRows += 1;
        rowResults.push({
          rowNumber: row.rowNumber,
          primaryEmail,
          status: "ERROR",
          message:
            error instanceof Error && error.message ? error.message : "Failed to update user role assignment.",
        });
      }

      await updateJob({
        id: jobId,
        status: "PROCESSING",
        processedRows,
        successCount,
        failureCount,
        message: `Processing ${processedRows}/${parseResult.rows.length} rows...`,
      });
    }

    const finalMessage = `Processed ${processedRows}/${parseResult.rows.length} rows. Successes: ${successCount}. Failures: ${failureCount}.`;
    const resultKey = await writeResults(jobId, { rows: rowResults });
    await updateJob({
      id: jobId,
      status: failureCount > 0 ? "FAILED" : "SUCCEEDED",
      processedRows,
      successCount,
      failureCount,
      totalRows: parseResult.rows.length,
      message: finalMessage,
      completedAt: new Date().toISOString(),
      resultS3Key: resultKey,
    });
  } catch (error) {
    console.error("User role import worker failed", error);
    await updateJob({
      id: jobId,
      status: "FAILED",
      message:
        error instanceof Error && error.message
          ? error.message
          : "User role import failed.",
      completedAt: new Date().toISOString(),
    });
  }
};
