import type { Handler } from "aws-lambda";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";

import type { Schema } from "../../data/resource";
import {
  parseStudentProfileCsv,
  buildStudentProfileValues,
  buildAdminUpsertUserProfileInput,
  type WorkerStudentProfileImportParseResult,
  type WorkerStudentProfileImportRow,
} from "./importHelpers";
import { env } from "$amplify/env/student-profile-import-worker";

type WorkerEvent = {
  jobId?: string;
};

type UserRoleAssignment = Schema["UserRoleAssignment"]["type"];

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
const prefix = env.IMPORT_BUCKET_PREFIX ?? "protected/admin/student-profile-imports";

if (!bucketName) {
  throw new Error("IMPORT_BUCKET_NAME environment variable is missing.");
}

type JobUpdateInput = Parameters<
  (typeof dataClient)["models"]["StudentProfileImportJob"]["update"]
>[0];

async function updateJob(values: JobUpdateInput) {
  const response = await dataClient.models.StudentProfileImportJob.update(values);
  if (response.errors?.length) {
    console.error("Failed to update StudentProfileImportJob", values.id, response.errors);
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

async function loadCsv(job: Schema["StudentProfileImportJob"]["type"]) {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: job.csvS3Key,
    })
  );
  const body = await streamToString(response.Body as AsyncIterable<Uint8Array>);
  return body;
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

type ListUserAssignmentsResult = Awaited<
  ReturnType<(typeof dataClient)["models"]["UserRoleAssignment"]["list"]>
>;
type AdminUpsertInput = Parameters<
  (typeof dataClient)["mutations"]["adminUpsertUserProfile"]
>[0];

async function loadUserAssignments(): Promise<Map<string, UserRoleAssignment>> {
  const map = new Map<string, UserRoleAssignment>();
  let nextToken: string | null = null;

  do {
    const listInput: Parameters<
      (typeof dataClient)["models"]["UserRoleAssignment"]["list"]
    >[0] = {
      limit: 200,
      nextToken: nextToken ?? undefined,
    };
    const response: ListUserAssignmentsResult =
      await dataClient.models.UserRoleAssignment.list(listInput);
    if (response.errors?.length) {
      throw new Error(response.errors.map((error: { message?: string }) => error.message).join(", "));
    }
    const items = (response.data ?? []) as Array<UserRoleAssignment | null>;
    for (const item of items) {
      if (!item) continue;
      const key = (item.primaryEmailLower ?? item.primaryEmail ?? "").toLowerCase();
      if (key) {
        map.set(key, item);
      }
    }
    nextToken = response.nextToken ?? null;
  } while (nextToken);

  return map;
}

export const handler: Handler = async (event: WorkerEvent) => {
  const jobId = event?.jobId;
  if (!jobId) {
    console.error("student-profile-import-worker invoked without jobId.");
    return;
  }

  const jobGet = await dataClient.models.StudentProfileImportJob.get({ id: jobId });
  if (jobGet.errors?.length) {
    console.error("Failed to load job", jobId, jobGet.errors);
    return;
  }
  const job = jobGet.data;
  if (!job) {
    console.error("Job not found", jobId);
    return;
  }

  const nowIso = new Date().toISOString();
  await updateJob({
    id: jobId,
    status: "PROCESSING",
    startedAt: job.startedAt ?? nowIso,
    message: "Processing student profile import...",
  });

  try {
    const csv = await loadCsv(job);
    const parseResult: WorkerStudentProfileImportParseResult = parseStudentProfileCsv(csv);

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

    const userAssignments = await loadUserAssignments();

    const rowResults: Array<{
      rowNumber: number;
      primaryEmail: string | null;
      status: "SUCCESS" | "ERROR";
      message?: string;
    }> = [];

    let processedRows = 0;
    let successCount = 0;
    let failureCount = 0;
    const actionableRows = parseResult.rows.filter(
      (row: WorkerStudentProfileImportRow) => row.errors.length === 0 && row.profile
    );

    // Pre-record parse errors
    for (const row of parseResult.rows) {
      if (row.errors.length > 0 || !row.profile) {
        failureCount += 1;
        processedRows += 1;
        rowResults.push({
          rowNumber: row.rowNumber,
          primaryEmail: row.primaryEmail ?? null,
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

    const batchSize = 10;
    for (let i = 0; i < actionableRows.length; i += batchSize) {
      const batch = actionableRows.slice(i, i + batchSize);
      for (const row of batch) {
        const primaryEmail = row.primaryEmail ?? null;
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

        const assignment = userAssignments.get(primaryEmail.toLowerCase());
        if (!assignment?.id) {
          failureCount += 1;
          processedRows += 1;
          rowResults.push({
            rowNumber: row.rowNumber,
            primaryEmail,
            status: "ERROR",
            message: "No matching user account found. Create the account first.",
          });
          continue;
        }

        try {
          const values = buildStudentProfileValues(row, assignment.id);
          if (!values) {
            throw new Error("Row data invalid after normalization.");
          }
          const input = buildAdminUpsertUserProfileInput(values, { status: values.status }) as AdminUpsertInput;
          const mutation = await dataClient.mutations.adminUpsertUserProfile(input, { authMode: "iam" });
          if (mutation.errors?.length) {
            throw new Error(
              mutation.errors.map((error: { message?: string }) => error.message).join(", ")
            );
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
              error instanceof Error && error.message
                ? error.message
                : "Failed to save profile.",
          });
        }
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
    console.error("Student profile import worker failed", error);
    await updateJob({
      id: jobId,
      status: "FAILED",
      message:
        error instanceof Error && error.message
          ? error.message
          : "Student profile import failed.",
      completedAt: new Date().toISOString(),
    });
  }
};
