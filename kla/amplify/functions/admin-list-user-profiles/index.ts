import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import type { Handler } from "aws-lambda";
import { env } from "$amplify/env/admin-list-user-profiles";

import type { Schema } from "../../data/resource";

type ListArgs = {
  userType?: Schema["UserType"]["type"] | null;
  status?: Schema["ProfileLifecycleStatus"]["type"] | null;
  search?: string | null;
  nameContains?: string | null;
  email?: string | null;
  grade?: number | null;
  dateOfBirthFrom?: string | null;
  dateOfBirthTo?: string | null;
  updatedFrom?: string | null;
  updatedTo?: string | null;
  limit?: number | null;
  nextToken?: string | null;
};

type AppSyncEvent = {
  arguments?: ListArgs;
};

type FilterExpression = Record<string, unknown>;
type ListResponse = Schema["UserProfileListResult"]["type"];

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

const PROFILE_SK = "PROFILE";
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export const handler: Handler = async (event: AppSyncEvent) => {
  const args = event.arguments ?? {};
  const limit = clampLimit(args.limit);
  const nextToken = args.nextToken ?? undefined;
  const search = normalizeSearch(args.search);
  const nameContains = normalizeSearch(args.nameContains);
  const emailLower = normalizeEmail(args.email);
  const grade = normalizeGrade(args.grade);
  const dateOfBirthFrom = normalizeDateOnly(args.dateOfBirthFrom);
  const dateOfBirthTo = normalizeDateOnly(args.dateOfBirthTo);
  const updatedFrom = normalizeDateTime(args.updatedFrom, "start");
  const updatedTo = normalizeDateTime(args.updatedTo, "end");

  const filters: FilterExpression[] = [{ sk: { eq: PROFILE_SK } }];

  if (args.userType) {
    filters.push({ userType: { eq: normalizeUserType(args.userType) } });
  }

  if (args.status) {
    filters.push({ status: { eq: normalizeStatus(args.status) } });
  }

  const filter = buildFilter(filters);

  const predicate = createProfilePredicate({
    searchLower: search?.toLowerCase() ?? null,
    nameContains: nameContains?.toLowerCase() ?? null,
    emailLower,
    grade,
    dateOfBirthFrom,
    dateOfBirthTo,
    updatedFrom,
    updatedTo,
  });

  if (!predicate) {
    return await listProfilesSimple({ filter, limit, nextToken });
  }

  return await listProfilesWithPredicate({ filter, limit, nextToken, predicate });
};

async function listProfilesSimple({
  filter,
  limit,
  nextToken,
}: {
  filter: FilterExpression;
  limit: number;
  nextToken?: string | null;
}): Promise<ListResponse> {
  const { data, errors, nextToken: token } = await client.models.UserProfile.list({
    filter,
    limit,
    nextToken: nextToken ?? undefined,
  });

  if (errors?.length) {
    throw new Error(errors.map((error) => error.message ?? "Unknown error").join(", "));
  }

  const items = (data ?? [])
    .filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined)
    .map(mapProfileToListItem);

  return {
    items,
    nextToken: token ?? null,
  };
}

async function listProfilesWithPredicate({
  filter,
  limit,
  nextToken,
  predicate,
}: {
  filter: FilterExpression;
  limit: number;
  nextToken?: string | null;
  predicate: (profile: Schema["UserProfileListItem"]["type"]) => boolean;
}): Promise<ListResponse> {
  let accumulated: Schema["UserProfileListItem"]["type"][] = [];
  let token = nextToken ?? null;
  let iterations = 0;
  const pageLimit = Math.min(MAX_LIMIT, Math.max(limit, 25));

  while (accumulated.length < limit) {
    const { data, errors, nextToken: pageToken } = await client.models.UserProfile.list({
      filter,
      limit: pageLimit,
      nextToken: token ?? undefined,
    });

    if (errors?.length) {
      throw new Error(errors.map((error) => error.message ?? "Unknown error").join(", "));
    }

    const pageItems = (data ?? [])
      .filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined)
      .map(mapProfileToListItem);

    const filteredItems = pageItems.filter((profile) => predicate(profile));

    accumulated = accumulated.concat(filteredItems);
    token = pageToken ?? null;

    iterations += 1;
    if (iterations > 25) {
      console.warn("Stopping student profile search pagination after 25 pages.");
      break;
    }
    if (!token) {
      break;
    }
  }

  return {
    items: accumulated.slice(0, limit),
    nextToken: token ?? null,
  };
}

function clampLimit(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(value), 1), MAX_LIMIT);
}

function normalizeSearch(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeEmail(value?: string | null): string | null {
  const normalized = normalizeSearch(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeGrade(value?: number | null): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  const clamped = Math.round(value);
  if (clamped < 0 || clamped > 12) return null;
  return clamped;
}

function normalizeDateOnly(value?: string | null): string | null {
  const trimmed = normalizeSearch(value);
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function normalizeDateTime(value: string | null | undefined, boundary: "start" | "end"): string | null {
  const dateOnly = normalizeDateOnly(value);
  if (!dateOnly) return null;
  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  return `${dateOnly}${suffix}`;
}

function normalizeUserType(value: Schema["UserType"]["type"]) {
  if (value !== "STUDENT" && value !== "STAFF" && value !== "PARENT" && value !== "OTHER") {
    throw new Error(`Unsupported userType: ${value}`);
  }
  return value;
}

function normalizeStatus(value: Schema["ProfileLifecycleStatus"]["type"]) {
  if (value !== "ACTIVE" && value !== "DRAFT" && value !== "ARCHIVED" && value !== "INACTIVE") {
    throw new Error(`Invalid profile status: ${value}`);
  }
  return value;
}

function buildFilter(filters: FilterExpression[]): FilterExpression {
  if (filters.length === 1) {
    return filters[0];
  }
  return { and: filters };
}

function mapProfileToListItem(profile: Schema["UserProfile"]["type"]): Schema["UserProfileListItem"]["type"] {
  return {
    pk: profile.pk,
    sk: profile.sk,
    userId: profile.userId,
    userType: profile.userType,
    status: profile.status,
    displayName: profile.displayName ?? undefined,
    legalName: profile.legalName ?? undefined,
    preferredName: profile.preferredName ?? undefined,
    primaryEmail: profile.primaryEmail ?? undefined,
    primaryEmailLower: profile.primaryEmailLower ?? undefined,
    secondaryEmails: profile.secondaryEmails ?? [],
    phoneNumbers: profile.phoneNumbers ?? [],
    student: profile.student ?? undefined,
    studentGrade: profile.studentGrade ?? undefined,
    tags: profile.tags ?? [],
    notes: profile.notes ?? undefined,
    archivedAt: profile.archivedAt ?? undefined,
    deactivatedAt: profile.deactivatedAt ?? undefined,
    completedAt: profile.completedAt ?? undefined,
    lastReviewedAt: profile.lastReviewedAt ?? undefined,
    updatedBySub: profile.updatedBySub ?? undefined,
    updatedByEmail: profile.updatedByEmail ?? undefined,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function createProfilePredicate({
  searchLower,
  nameContains,
  emailLower,
  grade,
  dateOfBirthFrom,
  dateOfBirthTo,
  updatedFrom,
  updatedTo,
}: {
  searchLower: string | null;
  nameContains: string | null;
  emailLower: string | null;
  grade: number | null;
  dateOfBirthFrom: string | null;
  dateOfBirthTo: string | null;
  updatedFrom: string | null;
  updatedTo: string | null;
}): ((profile: Schema["UserProfileListItem"]["type"]) => boolean) | null {
  if (!searchLower && !nameContains && !emailLower && grade === null && !dateOfBirthFrom && !dateOfBirthTo && !updatedFrom && !updatedTo) {
    return null;
  }

  return (profile) => {
    if (searchLower && !matchesSearch(profile, searchLower)) {
      return false;
    }
    if (nameContains && !matchesName(profile, nameContains)) {
      return false;
    }
    if (emailLower && !matchesEmail(profile, emailLower)) {
      return false;
    }
    if (grade !== null && typeof profile.studentGrade === "number" && profile.studentGrade !== grade) {
      return false;
    }
    if (grade !== null && typeof profile.studentGrade !== "number") {
      return false;
    }
    if (!isDateInRange(profile.student?.dateOfBirth ?? null, dateOfBirthFrom, dateOfBirthTo)) {
      return false;
    }
    if (!isDateTimeInRange(profile.updatedAt ?? null, updatedFrom, updatedTo)) {
      return false;
    }
    return true;
  };
}

function matchesSearch(profile: Schema["UserProfileListItem"]["type"], searchLower: string): boolean {
  const student = profile.student ?? null;
  const candidates: Array<string | null | undefined> = [
    profile.displayName,
    profile.legalName,
    profile.preferredName,
    profile.primaryEmail,
    profile.primaryEmailLower,
    profile.notes,
    profile.userId,
    ...(profile.tags ?? []),
    ...(profile.secondaryEmails ?? []),
    ...(profile.phoneNumbers ?? []),
    student?.fullName ?? null,
    student?.motherName ?? null,
    student?.fatherName ?? null,
    student?.motherEmail ?? null,
    student?.fatherEmail ?? null,
    student?.motherPhone ?? null,
    student?.fatherPhone ?? null,
    student?.homeAddress ?? null,
    student?.homeCity ?? null,
  ];

  return candidates.some((candidate) => {
    if (typeof candidate !== "string") return false;
    return candidate.toLowerCase().includes(searchLower);
  });
}

function matchesName(profile: Schema["UserProfileListItem"]["type"], nameLower: string): boolean {
  const nameCandidates = [
    profile.displayName,
    profile.legalName,
    profile.preferredName,
    profile.student?.fullName ?? null,
  ];
  return nameCandidates.some((candidate) => {
    if (typeof candidate !== "string") return false;
    return candidate.toLowerCase().includes(nameLower);
  });
}

function matchesEmail(profile: Schema["UserProfileListItem"]["type"], emailLower: string): boolean {
  const primary =
    profile.primaryEmailLower ?? (typeof profile.primaryEmail === "string" ? profile.primaryEmail.toLowerCase() : null);
  if (primary === emailLower) {
    return true;
  }
  return (profile.secondaryEmails ?? []).some((email) => typeof email === "string" && email.toLowerCase() === emailLower);
}

function isDateInRange(value: string | null | undefined, from: string | null, to: string | null): boolean {
  if (!from && !to) return true;
  if (!value) return false;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

function isDateTimeInRange(value: string | null | undefined, from: string | null, to: string | null): boolean {
  if (!from && !to) return true;
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return false;
  if (from) {
    const fromTs = Date.parse(from);
    if (!Number.isNaN(fromTs) && timestamp < fromTs) return false;
  }
  if (to) {
    const toTs = Date.parse(to);
    if (!Number.isNaN(toTs) && timestamp > toTs) return false;
  }
  return true;
}
