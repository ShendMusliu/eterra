import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import type { Handler } from "aws-lambda";
import { env } from "$amplify/env/admin-upsert-user-profile";

import type { Schema } from "../../data/resource";
import { deriveStudentGradeFromEmail } from "../../../shared/studentGrade";

type AppSyncIdentity = {
  sub?: string;
  username?: string;
  claims?: Record<string, unknown>;
};

type AppSyncEvent = {
  arguments?: UpsertArgs;
  identity?: AppSyncIdentity;
};

type UpsertArgs = {
  userId: string;
  userType: Schema["UserType"]["type"];
  status?: Schema["ProfileLifecycleStatus"]["type"] | null;
  displayName?: string | null;
  legalName?: string | null;
  preferredName?: string | null;
  primaryEmail?: string | null;
  secondaryEmails?: string[] | null;
  phoneNumbers?: string[] | null;
  student?: Schema["StudentProfile"]["type"] | null;
  tags?: string[] | null;
  notes?: string | null;
  archivedAt?: string | null;
  deactivatedAt?: string | null;
  completedAt?: string | null;
  lastReviewedAt?: string | null;
};

type UserProfile = Schema["UserProfile"]["type"];
type StudentProfile = Schema["StudentProfile"]["type"];

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
const DEFAULT_STATUS: Schema["ProfileLifecycleStatus"]["type"] = "ACTIVE";

export const handler: Handler = async (event: AppSyncEvent) => {
  const input = event.arguments;
  if (!input) {
    throw new Error("Missing input arguments.");
  }

  const userId = normalizeId(input.userId);
  if (!userId) {
    throw new Error("userId is required.");
  }

  const userType = normalizeUserType(input.userType);
  const statusInput = Object.prototype.hasOwnProperty.call(input, "status")
    ? normalizeStatus(input.status)
    : undefined;

  const { sub: actorSub, email: actorEmail } = await resolveActorIdentity(event.identity);
  const auditFields = {
    ...(actorSub ? { updatedBySub: actorSub } : {}),
    ...(actorEmail ? { updatedByEmail: actorEmail } : {}),
  };

  await ensureRoleAssignmentExists(userId);

  const pk = buildPk(userId);
  const sk = PROFILE_SK;

  const existing = await getExistingProfile(pk, sk);
  const status = statusInput ?? existing?.status ?? DEFAULT_STATUS;

  const primaryEmailProvided = hasOwn(input, "primaryEmail");
  const normalizedPrimaryEmail = primaryEmailProvided ? normalizeEmail(input.primaryEmail) : undefined;
  const primaryEmailLower =
    normalizedPrimaryEmail !== undefined && normalizedPrimaryEmail !== null
      ? normalizedPrimaryEmail
      : primaryEmailProvided
        ? null
        : existing?.primaryEmailLower ?? null;

  if (primaryEmailLower) {
    await assertUniqueProfileEmail(primaryEmailLower, pk, sk);
  }

  const secondaryEmails =
    hasOwn(input, "secondaryEmails") || !existing
      ? normalizeEmailArray(input.secondaryEmails)
      : existing?.secondaryEmails ?? [];

  const phoneNumbers =
    hasOwn(input, "phoneNumbers") || !existing
      ? normalizeStringArray(input.phoneNumbers)
      : existing?.phoneNumbers ?? [];

  const tags =
    hasOwn(input, "tags") || !existing ? normalizeStringArray(input.tags, { toUpper: false }) : existing?.tags ?? [];

  const notes =
    hasOwn(input, "notes") || !existing ? normalizeNullableString(input.notes) : existing?.notes ?? null;

  const studentValue = resolveStudentValue({
    userType,
    inputStudent: hasOwn(input, "student") ? input.student ?? null : undefined,
    existingStudent: existing?.student ?? null,
  });

  const targetPrimaryEmail =
    normalizedPrimaryEmail !== undefined ? normalizedPrimaryEmail : existing?.primaryEmail ?? null;
  const studentGrade =
    userType === "STUDENT" ? deriveStudentGradeFromEmail(targetPrimaryEmail ?? existing?.primaryEmailLower ?? null) : null;

  const displayName = resolveDisplayName({
    inputDisplayName: hasOwn(input, "displayName") ? input.displayName ?? null : undefined,
    existingDisplayName: existing?.displayName ?? null,
    studentFullName: studentValue?.fullName ?? null,
  });

  const legalName =
    hasOwn(input, "legalName") || !existing ? normalizeNullableString(input.legalName) : existing?.legalName ?? null;
  const preferredName =
    hasOwn(input, "preferredName") || !existing
      ? normalizeNullableString(input.preferredName)
      : existing?.preferredName ?? null;

  const archivedAt = resolveLifecycleTimestamp({
    provided: hasOwn(input, "archivedAt") ? input.archivedAt ?? null : undefined,
    existing: existing?.archivedAt ?? null,
    activateOnStatus: status === "ARCHIVED" && existing?.status !== "ARCHIVED",
  });

  const deactivatedAt = resolveLifecycleTimestamp({
    provided: hasOwn(input, "deactivatedAt") ? input.deactivatedAt ?? null : undefined,
    existing: existing?.deactivatedAt ?? null,
    activateOnStatus: status === "INACTIVE" && existing?.status !== "INACTIVE",
  });

  const completedAt = resolveLifecycleTimestamp({
    provided: hasOwn(input, "completedAt") ? input.completedAt ?? null : undefined,
    existing: existing?.completedAt ?? null,
  });

  const lastReviewedAt = resolveLifecycleTimestamp({
    provided: hasOwn(input, "lastReviewedAt") ? input.lastReviewedAt ?? null : undefined,
    existing: existing?.lastReviewedAt ?? null,
  });

  const baseRecord = compact({
    pk,
    sk,
    userId,
    userType,
    status,
    displayName,
    legalName,
    preferredName,
    primaryEmail:
      normalizedPrimaryEmail !== undefined
        ? normalizedPrimaryEmail
        : existing?.primaryEmail ?? null,
    primaryEmailLower,
    secondaryEmails,
    phoneNumbers,
    student: studentValue,
    studentGrade,
    tags,
    notes,
    archivedAt,
    deactivatedAt,
    completedAt,
    lastReviewedAt,
    ...auditFields,
  });

  const result = existing
    ? await client.models.UserProfile.update(baseRecord as Schema["UserProfile"]["updateType"])
    : await client.models.UserProfile.create(baseRecord as Schema["UserProfile"]["createType"]);

  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message ?? "Unknown error").join(", "));
  }

  return result.data;
};

async function ensureRoleAssignmentExists(userId: string): Promise<void> {
  const { data, errors } = await client.models.UserRoleAssignment.get({ id: userId });
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message ?? "Unknown error").join(", "));
  }
  if (!data) {
    throw new Error("Role assignment for this user was not found.");
  }
}

async function getExistingProfile(pk: string, sk: string): Promise<UserProfile | null> {
  const { data, errors } = await client.models.UserProfile.get({ pk, sk });
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message ?? "Unknown error").join(", "));
  }
  return data ?? null;
}

async function assertUniqueProfileEmail(emailLower: string, pk: string, sk: string) {
  const { data, errors } = await client.models.UserProfile.list({
    filter: {
      primaryEmailLower: { eq: emailLower },
      sk: { eq: PROFILE_SK },
    },
    limit: 5,
  });
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message ?? "Unknown error").join(", "));
  }
  const conflict = (data ?? []).find((profile) => profile?.pk !== pk || profile?.sk !== sk);
  if (conflict) {
    throw new Error("Another user profile already uses this primary email.");
  }
}

function resolveStudentValue({
  userType,
  inputStudent,
  existingStudent,
}: {
  userType: Schema["UserType"]["type"];
  inputStudent?: StudentProfile | null;
  existingStudent: StudentProfile | null;
}): StudentProfile | null {
  if (userType !== "STUDENT") {
    if (inputStudent && hasMeaningfulStudentData(inputStudent)) {
      console.warn("Ignoring student payload for non-student user type.");
    }
    return null;
  }

  const target = inputStudent ?? existingStudent ?? null;
  if (!target) {
    throw new Error("Student profile data is required for student user types.");
  }

  const normalized = normalizeStudent(target);
  if (!normalized.fullName) {
    throw new Error("Student full name is required.");
  }
  return normalized;
}

function resolveDisplayName({
  inputDisplayName,
  existingDisplayName,
  studentFullName,
}: {
  inputDisplayName?: string | null;
  existingDisplayName: string | null;
  studentFullName: string | null;
}): string | null {
  if (inputDisplayName !== undefined) {
    return normalizeNullableString(inputDisplayName);
  }
  if (existingDisplayName) {
    return existingDisplayName;
  }
  return studentFullName ? normalizeNullableString(studentFullName) : null;
}

function resolveLifecycleTimestamp({
  provided,
  existing,
  activateOnStatus = false,
}: {
  provided?: string | null;
  existing: string | null;
  activateOnStatus?: boolean;
}): string | null {
  if (provided !== undefined) {
    return normalizeDateTime(provided);
  }
  if (activateOnStatus && !existing) {
    return new Date().toISOString();
  }
  return existing ?? null;
}

async function resolveActorIdentity(identity?: AppSyncIdentity) {
  const claims = identity?.claims ?? {};
  const sub = pickFirstString([
    identity?.sub,
    stringClaim(claims.sub),
    identity?.username,
    stringClaim(claims["cognito:username"]),
  ]);
  let email = stringClaim(claims.email);
  if (email) {
    email = normalizeEmail(email) ?? "";
  }
  return { sub: sub ?? "", email };
}

function normalizeId(value?: string | null): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!/^[0-9a-fA-F-]{10,}$/.test(trimmed)) {
    throw new Error("userId must be a UUID-like string.");
  }
  return trimmed;
}

function normalizeUserType(value?: string | null): Schema["UserType"]["type"] {
  if (!value) {
    throw new Error("userType is required.");
  }
  if (value !== "STUDENT" && value !== "STAFF" && value !== "PARENT" && value !== "OTHER") {
    throw new Error(`Unsupported userType: ${value}`);
  }
  return value;
}

function normalizeStatus(value?: Schema["ProfileLifecycleStatus"]["type"] | null) {
  if (!value) return undefined;
  if (value !== "ACTIVE" && value !== "DRAFT" && value !== "ARCHIVED" && value !== "INACTIVE") {
    throw new Error(`Invalid profile status: ${value}`);
  }
  return value;
}

function buildPk(userId: string) {
  return `${USER_PK_PREFIX}${userId}`;
}

function normalizeEmail(value?: string | null): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error(`Invalid email address: ${value}`);
  }
  return trimmed;
}

function normalizeEmailArray(values?: string[] | null): string[] {
  if (!Array.isArray(values)) return [];
  const normalized = new Set<string>();
  for (const value of values) {
    const email = normalizeEmail(value);
    if (email) {
      normalized.add(email);
    }
  }
  return Array.from(normalized);
}

function normalizeStringArray(
  values?: string[] | null,
  options: { toUpper?: boolean } = {}
): string[] {
  if (!Array.isArray(values)) return [];
  const normalized = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    let processed = value.trim();
    if (!processed) continue;
    if (options.toUpper) {
      processed = processed.toUpperCase();
    }
    normalized.add(processed);
  }
  return Array.from(normalized);
}

function normalizeNullableString(value?: string | null): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(value?: string | null): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    if (["true", "yes", "y", "1"].includes(trimmed)) return true;
    if (["false", "no", "n", "0"].includes(trimmed)) return false;
  }
  return null;
}

function normalizeDate(value?: string | null): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return date.toISOString().slice(0, 10);
}

function normalizeDateTime(value?: string | null): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime value: ${value}`);
  }
  return date.toISOString();
}

function hasMeaningfulStudentData(profile: StudentProfile | null): boolean {
  if (!profile) return false;
  return Boolean(
    profile.fullName?.trim().length ||
      profile.motherName?.trim().length ||
      profile.fatherName?.trim().length ||
      profile.comments?.trim().length ||
      profile.homeAddress?.trim().length ||
      profile.homeCity?.trim().length ||
      profile.healthNotes?.trim().length
  );
}

function normalizeStudent(student: StudentProfile): StudentProfile {
  const normalized: StudentProfile = {
    fullName: normalizeNullableString(student.fullName) ?? "",
    dateOfBirth: normalizeDate(student.dateOfBirth),
    motherName: normalizeNullableString(student.motherName),
    motherEmail: normalizeEmail(student.motherEmail),
    motherPhone: normalizePhone(student.motherPhone),
    motherProfession: normalizeNullableString(student.motherProfession),
    fatherName: normalizeNullableString(student.fatherName),
    fatherEmail: normalizeEmail(student.fatherEmail),
    fatherPhone: normalizePhone(student.fatherPhone),
    fatherProfession: normalizeNullableString(student.fatherProfession),
    healthNotes: normalizeNullableString(student.healthNotes),
    receivesSocialAssistance: normalizeBoolean(student.receivesSocialAssistance),
    livesWithBothParents: normalizeBoolean(student.livesWithBothParents),
    livesWithParentsDetails: normalizeNullableString(student.livesWithParentsDetails),
    comments: normalizeNullableString(student.comments),
    homeAddress: normalizeNullableString(student.homeAddress),
    homeCity: normalizeNullableString(student.homeCity),
  };

  if (!normalized.fullName) {
    throw new Error("Student full name is required.");
  }
  return normalized;
}

function compact<T extends Record<string, unknown>>(input: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

function hasOwn<T extends object>(object: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
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
