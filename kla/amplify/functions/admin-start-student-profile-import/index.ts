import { randomUUID } from "node:crypto";
import type { Handler } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";

import type { Schema } from "../../data/resource";
import { env } from "$amplify/env/admin-start-student-profile-import";

type AppSyncEvent = {
  arguments?: {
    csv?: string;
    fileName?: string | null;
  };
  identity?: {
    sub?: string | null;
    username?: string | null;
    claims?: Record<string, unknown>;
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
} satisfies Record<string, string | undefined>;

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(dataEnv);
Amplify.configure(resourceConfig, libraryOptions);

const dataClient = generateClient<Schema>();
const s3Client = new S3Client({});
const lambdaClient = new LambdaClient({});

const bucketName = env.IMPORT_BUCKET_NAME;
const prefix = env.IMPORT_BUCKET_PREFIX ?? "protected/admin/student-profile-imports";
const workerFunctionName = env.IMPORT_WORKER_FUNCTION_NAME;

if (!bucketName) {
  throw new Error("IMPORT_BUCKET_NAME environment variable is missing.");
}
if (!workerFunctionName) {
  throw new Error("IMPORT_WORKER_FUNCTION_NAME environment variable is missing.");
}

function normalizeEmail(value?: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : undefined;
}

function resolveIdentity(event: AppSyncEvent) {
  const claims = event.identity?.claims ?? {};
  const sub =
    (typeof event.identity?.sub === "string" && event.identity?.sub) ||
    (typeof event.identity?.username === "string" && event.identity?.username) ||
    (typeof claims.sub === "string" && claims.sub) ||
    undefined;
  const email =
    normalizeEmail(claims.email) ??
    normalizeEmail(claims["custom:primaryEmail"] ?? claims["cognito:preferred_username"]);
  return { sub, email };
}

async function uploadCsvToS3(key: string, body: string) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: "text/csv; charset=utf-8",
    })
  );
}

async function invokeWorker(jobId: string) {
  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: workerFunctionName,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify({ jobId }), "utf8"),
    })
  );
}

export const handler: Handler = async (event: AppSyncEvent) => {
  const csv = event.arguments?.csv ?? "";
  const originalFileName = event.arguments?.fileName ?? null;

  if (!csv.trim()) {
    throw new Error("CSV content is required.");
  }

  const normalisedLines = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmptyLines = normalisedLines.filter((line) => line.trim().length > 0);
  const totalRows = nonEmptyLines.length > 0 ? Math.max(nonEmptyLines.length - 1, 0) : 0;

  const { sub, email } = resolveIdentity(event);
  const jobId = randomUUID();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sanitizedName =
    typeof originalFileName === "string" && originalFileName.trim().length > 0
      ? originalFileName.trim().slice(0, 120)
      : `student-import-${timestamp}.csv`;
  const csvKey = `${prefix}/${jobId}/source.csv`;

  await uploadCsvToS3(csvKey, csv);

  const jobInput: Parameters<
    typeof dataClient.models.StudentProfileImportJob.create
  >[0] = {
    id: jobId,
    status: "QUEUED",
    csvS3Key: csvKey,
    sourceFilename: sanitizedName,
    processedRows: 0,
    successCount: 0,
    failureCount: 0,
    message: "Queued for processing.",
    createdBySub: sub ?? undefined,
    createdByEmail: email ?? undefined,
    totalRows,
  };

  const createResult = await dataClient.models.StudentProfileImportJob.create(jobInput);
  if (createResult.errors?.length) {
    throw new Error(createResult.errors.map((error) => error.message).join(", "));
  }

  await invokeWorker(jobId);

  return createResult.data;
};
