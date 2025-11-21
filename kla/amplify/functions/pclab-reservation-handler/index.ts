import type { Handler } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import {
  CognitoIdentityProviderClient,
  ListUsersInGroupCommand,
  AttributeType,
  ListUsersInGroupCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";
import { DateTime } from "luxon";
import { randomUUID } from "crypto";
import { env } from "$amplify/env/pclab-reservation-handler";
import type { Schema } from "../../data/resource";

type Reservation = Schema["PCLabReservation"]["type"];
type ReservationEvent = Schema["PCLabReservationEvent"]["type"];
type SubmissionInput = Schema["PCLabReservationSubmissionInput"]["type"];
type UpdateInput = Schema["PCLabReservationSelfUpdateInput"]["type"];
type Status = Schema["PCLabReservationStatus"]["type"];
type UpdateAction = Schema["PCLabReservationSelfUpdateAction"]["type"];

type IdentityClaims = Record<string, any>;
type AppSyncIdentity = {
  sub?: string;
  username?: string;
  claims?: IdentityClaims;
};

const SCHOOL_TIMEZONE = "Europe/Belgrade";
const LAB_CAPACITY = 12;

const dataEnv = { ...env, AMPLIFY_DATA_DEFAULT_NAME: process.env.AMPLIFY_DATA_DEFAULT_NAME ?? "" };
const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(dataEnv);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
type ModelOperationResult<T> = Promise<{ data?: T | null; errors?: { message: string }[] }>;
type ModelCollectionResult<T> = Promise<{ data?: (T | null)[]; errors?: { message: string }[] }>;
type ModelApi<T> = {
  list: (...args: any[]) => ModelCollectionResult<T>;
  get: (...args: any[]) => ModelOperationResult<T>;
  create: (...args: any[]) => ModelOperationResult<T>;
  update: (...args: any[]) => ModelOperationResult<T>;
};

const pclabReservations = ((client.models as any).PCLabReservation || {}) as ModelApi<Reservation>;
const pclabReservationEvents =
  ((client.models as any).PCLabReservationEvent || {}) as ModelApi<ReservationEvent>;
const ses = new SESClient({});
const cognito = new CognitoIdentityProviderClient({});

function getEnv(name: string, required = false): string | undefined {
  const value = (process.env[name] || (env as any)?.[name]) as string | undefined;
  if (required && !value) throw new Error(`Missing required env: ${name}`);
  return value;
}

const baseUrl = (getEnv("APP_BASE_URL") || "").replace(/\/$/, "");
const sesSender = getEnv("SES_SENDER") || "";
const adminEmails = parseCsv(getEnv("ADMIN_EMAILS"));
const userPoolId = getEnv("USER_POOL_ID", true)!;

function parseCsv(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function extractGroupsFromIdentity(identity: AppSyncIdentity): string[] {
  const tokenGroups = identity?.claims?.["cognito:groups"];
  const directGroups = Array.isArray((identity as any)?.groups) ? ((identity as any)?.groups as string[]) : [];
  const normalized =
    Array.isArray(tokenGroups) ? tokenGroups : typeof tokenGroups === "string" ? tokenGroups.split(",") : [];
  return Array.from(
    new Set([...directGroups, ...normalized].map((entry) => String(entry || "").trim()).filter((entry) => entry.length))
  );
}

async function resolveItAdminsEmails(): Promise<string[]> {
  if (!userPoolId) return [];
  const recipients = new Set<string>();
  let nextToken: string | undefined;
  do {
    const out: ListUsersInGroupCommandOutput = await cognito.send(
      new ListUsersInGroupCommand({
        GroupName: "ITAdmins",
        UserPoolId: userPoolId,
        Limit: 60,
        NextToken: nextToken,
      })
    );
    for (const user of out.Users || []) {
      const attr = (user.Attributes || []).find((a: AttributeType | undefined) => a?.Name === "email");
      const emailVal = (attr?.Value || "").trim();
      if (emailVal) recipients.add(emailVal);
    }
    nextToken = out.NextToken;
  } while (nextToken);
  return Array.from(recipients);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatHtml(body: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.4;white-space:pre-wrap">${escapeHtml(body)}</div>`;
}

function getOwner(identity: AppSyncIdentity): string {
  const owner = (identity.username || identity.sub || "").trim();
  if (!owner) {
    throw new Error("Missing caller identity.");
  }
  return owner;
}

function getRequesterId(identity: AppSyncIdentity): string {
  return (identity.sub || identity.username || "").trim();
}

function getIdentityEmail(identity: AppSyncIdentity): string | undefined {
  return (identity.claims?.email || identity.claims?.preferred_username || "").toString().trim() || undefined;
}

function getIdentityName(identity: AppSyncIdentity): string | undefined {
  const claims = identity.claims || {};
  const direct = (claims.name || claims.preferred_username || "").toString().trim();
  if (direct) return direct;
  const given = (claims.given_name || "").toString().trim();
  const family = (claims.family_name || "").toString().trim();
  const combined = [given, family].filter(Boolean).join(" ").trim();
  return combined || undefined;
}

function parseTimeToMinutes(time: string): number {
  const trimmed = time.trim();
  const match = /^([0-1]\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (!match) throw new Error("Start and end times must be in HH:MM format (24-hour).");
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function combineDateTime(date: string, time: string): DateTime {
  const iso = `${date}T${time}`;
  const dt = DateTime.fromISO(iso, { zone: SCHOOL_TIMEZONE });
  if (!dt.isValid) throw new Error("Invalid date or time provided.");
  return dt;
}

function normalizeSubmissionInput(input: SubmissionInput): SubmissionInput {
  if (!input) throw new Error("Missing reservation input.");
  const fullName = (input.fullName || "").trim();
  const email = (input.email || "").trim();
  if (!fullName) throw new Error("Full name is required.");
  if (!email) throw new Error("Email is required.");
  const pcsNeeded = Number(input.pcsNeeded ?? 0);
  if (!Number.isInteger(pcsNeeded) || pcsNeeded < 1 || pcsNeeded > LAB_CAPACITY) {
    throw new Error(`PCs Needed must be between 1 and ${LAB_CAPACITY}.`);
  }
  const numberOfStudents =
    typeof input.numberOfStudents === "number" && Number.isFinite(input.numberOfStudents)
      ? Number(input.numberOfStudents)
      : undefined;
  if (typeof numberOfStudents === "number" && numberOfStudents <= 0) {
    throw new Error("Number of students must be greater than 0.");
  }
  if (typeof input.needsMonitor !== "boolean") {
    throw new Error("Please specify if monitoring assistance is needed.");
  }
  const needsMonitor = input.needsMonitor;
  const reservationDate = (input.reservationDate || "").trim();
  const startTime = (input.startTime || "").trim();
  const endTime = (input.endTime || "").trim();
  parseTimeToMinutes(startTime);
  parseTimeToMinutes(endTime);
  if (!reservationDate) throw new Error("Reservation date is required.");
  return {
    reservationDate,
    startTime,
    endTime,
    fullName,
    email,
    pcsNeeded,
    numberOfStudents,
    needsMonitor,
    extraComments: (input.extraComments || "").trim() || undefined,
  };
}

function requireSesSender(): string {
  if (!sesSender) {
    throw new Error("SES_SENDER environment variable is not configured.");
  }
  return sesSender;
}

async function sendEmail(to: string[], subject: string, bodyText: string): Promise<void> {
  if (!to.length) return;
  const sender = requireSesSender();
  const html = formatHtml(bodyText);
  const command = new SendEmailCommand({
    Source: sender,
    Destination: { ToAddresses: to },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Text: { Data: bodyText, Charset: "UTF-8" },
        Html: { Data: html, Charset: "UTF-8" },
      },
    },
  });
  try {
    await ses.send(command);
  } catch (error) {
    console.error("SES send failed", error);
  }
}

async function getAdminRecipients(): Promise<string[]> {
  const recipients = new Set<string>();
  for (const email of adminEmails) {
    if (email) recipients.add(email);
  }
  const itAdmins = await resolveItAdminsEmails();
  itAdmins.forEach((email) => recipients.add(email));
  return Array.from(recipients);
}

async function recordReservationEvent({
  reservation,
  actorSub,
  actorName,
  actorEmail,
  actorGroups,
  oldStatus,
  newStatus,
  notes,
}: {
  reservation: Reservation;
  actorSub: string;
  actorName?: string | null;
  actorEmail?: string | null;
  actorGroups?: string[];
  oldStatus?: Status | null;
  newStatus: Status;
  notes?: string | null;
}) {
  if (!reservation?.id) return;
  try {
    await pclabReservationEvents.create({
      reservationId: reservation.id,
      owner: reservation.owner || reservation.requesterId || actorSub,
      changedAt: new Date().toISOString(),
      changedBySub: actorSub,
      changedByName: actorName || undefined,
      changedByEmail: actorEmail || undefined,
      changedByGroups: actorGroups || [],
      oldStatus: oldStatus || undefined,
      newStatus,
      notes: notes || undefined,
    });
  } catch (error) {
    console.error("Failed to record reservation event", error);
  }
}

function buildReservationLink(reservationId?: string | null): string {
  if (!baseUrl || !reservationId) return baseUrl || "";
  return `${baseUrl}/dashboard/pc-lab-reservations/${reservationId}`;
}

function summarizeReservation(record: Reservation): string {
  const lines = [
    `Full Name: ${record.fullName}`,
    `Email: ${record.email}`,
    `Reservation Date: ${record.reservationDate}`,
    `Start Time: ${record.startTime}`,
    `End Time: ${record.endTime}`,
    `PCs Needed: ${record.pcsNeeded}`,
    `Number of Students: ${record.numberOfStudents ?? "n/a"}`,
    `Needs Monitor: ${record.needsMonitor ? "Yes" : "No"}`,
    `Status: ${record.status}`,
  ];
  if (record.extraComments) {
    lines.push(`Extra Comments: ${record.extraComments}`);
  }
  return lines.join("\n");
}

async function notifyOnSubmission(record: Reservation): Promise<void> {
  const recipients = await getAdminRecipients();
  const subject = `[KLA] PC Lab reservation submitted by ${record.fullName}`;
  const link = buildReservationLink(record.id);
  const body = `${record.fullName} submitted a PC Lab reservation.\n\n${summarizeReservation(record)}${
    link ? `\n\nReview: ${link}` : ""
  }`;
  if (recipients.length > 0) {
    await sendEmail(recipients, subject, body);
  }
  if (record.email) {
    const confirmation = `Hi ${record.fullName},

Your reservation request for the PC Lab has been received. We will notify you once it is reviewed.

Reservation summary:
${summarizeReservation(record)}

Thank you!`;
    await sendEmail([record.email], "We received your PC Lab reservation", confirmation);
  }
}

async function notifyOnStatusChange(record: Reservation, previousStatus: Status | undefined): Promise<void> {
  if (!record.email) return;
  const link = buildReservationLink(record.id);
  const subject = `[KLA] PC Lab reservation ${record.status.toLowerCase()}`;
  const body = `Hi ${record.fullName},

Your PC Lab reservation (${record.reservationDate} ${record.startTime}-${record.endTime}) is now ${record.status}.
${
  record.statusNotes
    ? `\nReviewer notes:\n${record.statusNotes}\n`
    : ""
}
${link ? `\nView details: ${link}\n` : ""}
Previous status: ${previousStatus || "n/a"}

Summary:
${summarizeReservation(record)}

KLA IT Team`;
  await sendEmail([record.email], subject, body);
}

async function notifyOnCancellation(record: Reservation): Promise<void> {
  const recipients = await getAdminRecipients();
  if (!recipients.length) return;
  const subject = `[KLA] PC Lab reservation cancelled by ${record.fullName}`;
  const body = `${record.fullName} cancelled their PC Lab reservation (${record.reservationDate} ${record.startTime}-${record.endTime}).\n\nSummary:\n${summarizeReservation(record)}`;
  await sendEmail(recipients, subject, body);
}

async function handleCreate(identity: AppSyncIdentity, rawInput: SubmissionInput): Promise<Reservation> {
  const owner = getOwner(identity);
  const requesterId = getRequesterId(identity);
  const submission = normalizeSubmissionInput(rawInput);
  const startMinutes = parseTimeToMinutes(submission.startTime);
  const endMinutes = parseTimeToMinutes(submission.endTime);
  if (startMinutes >= endMinutes) throw new Error("End time must be after start time.");
  const startDateTime = combineDateTime(submission.reservationDate, submission.startTime);
  const now = DateTime.now().setZone(SCHOOL_TIMEZONE);
  if (startDateTime <= now) {
    throw new Error("Reservation must be scheduled in the future.");
  }
  const createResult = await pclabReservations.create({
    id: randomUUID(),
    owner,
    requesterId,
    requesterEmail: getIdentityEmail(identity) || submission.email,
    requesterName: getIdentityName(identity) || submission.fullName,
    fullName: submission.fullName,
    email: submission.email,
    reservationDate: submission.reservationDate,
    startTime: submission.startTime,
    endTime: submission.endTime,
    pcsNeeded: submission.pcsNeeded,
    numberOfStudents: submission.numberOfStudents,
    needsMonitor: submission.needsMonitor,
    extraComments: submission.extraComments,
    status: "PENDING",
  });
  if (createResult.errors?.length) {
    throw new Error(createResult.errors.map((e) => e.message).join(", "));
  }
  const record = createResult.data!;
  await recordReservationEvent({
    reservation: record,
    actorSub: requesterId,
    actorName: getIdentityName(identity) || submission.fullName,
    actorEmail: getIdentityEmail(identity) || submission.email,
    actorGroups: extractGroupsFromIdentity(identity),
    oldStatus: null,
    newStatus: "PENDING",
    notes: "Reservation created",
  });
  await notifyOnSubmission(record);
  return record;
}

async function enforceEditable(ownerRecord: Reservation, now: DateTime) {
  const start = combineDateTime(ownerRecord.reservationDate, ownerRecord.startTime);
  const diffMinutes = start.diff(now, "minutes").minutes;
  if (diffMinutes < 60) {
    throw new Error("Reservations can only be edited or cancelled at least 1 hour before the start time.");
  }
}

async function handleOwnerUpdate(identity: AppSyncIdentity, rawInput: UpdateInput): Promise<Reservation> {
  const owner = getOwner(identity);
  if (!rawInput?.id) throw new Error("Reservation id is required.");
  const { data: existing, errors } = await pclabReservations.get({ id: rawInput.id });
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
  if (!existing) throw new Error("Reservation not found.");
  if (existing.owner !== owner) throw new Error("You can only update your own reservations.");

  const now = DateTime.now().setZone(SCHOOL_TIMEZONE);
  await enforceEditable(existing, now);

  const action = (rawInput.action || "UPDATE") as UpdateAction;
  if (action === "CANCEL") {
    const cancelResult = await pclabReservations.update({
      id: existing.id,
      status: "CANCELLED",
      statusNotes: "Cancelled by requester",
    });
    if (cancelResult.errors?.length) throw new Error(cancelResult.errors.map((e) => e.message).join(", "));
    const cancelled = cancelResult.data!;
    await recordReservationEvent({
      reservation: cancelled,
      actorSub: identity.sub || identity.username || owner,
      actorName: getIdentityName(identity) || existing.fullName,
      actorEmail: getIdentityEmail(identity) || existing.email,
      actorGroups: extractGroupsFromIdentity(identity),
      oldStatus: existing.status as Status | undefined,
      newStatus: "CANCELLED",
      notes: "Cancelled by requester",
    });
    await notifyOnCancellation(cancelled);
    return cancelled;
  }

  const mergedSubmission: SubmissionInput = normalizeSubmissionInput({
    reservationDate: rawInput.reservationDate ?? existing.reservationDate,
    startTime: rawInput.startTime ?? existing.startTime,
    endTime: rawInput.endTime ?? existing.endTime,
    fullName: rawInput.fullName ?? existing.fullName,
    email: rawInput.email ?? existing.email,
    pcsNeeded: rawInput.pcsNeeded ?? existing.pcsNeeded,
    numberOfStudents: rawInput.numberOfStudents ?? existing.numberOfStudents ?? undefined,
    needsMonitor: typeof rawInput.needsMonitor === "boolean" ? rawInput.needsMonitor : existing.needsMonitor,
    extraComments: rawInput.extraComments ?? existing.extraComments ?? undefined,
  } as SubmissionInput);

  const startMinutes = parseTimeToMinutes(mergedSubmission.startTime);
  const endMinutes = parseTimeToMinutes(mergedSubmission.endTime);
  if (startMinutes >= endMinutes) throw new Error("End time must be after start time.");

  const updateResult = await pclabReservations.update({
    id: existing.id,
    reservationDate: mergedSubmission.reservationDate,
    startTime: mergedSubmission.startTime,
    endTime: mergedSubmission.endTime,
    pcsNeeded: mergedSubmission.pcsNeeded,
    numberOfStudents: mergedSubmission.numberOfStudents,
    needsMonitor: mergedSubmission.needsMonitor,
    extraComments: mergedSubmission.extraComments,
    fullName: mergedSubmission.fullName,
    email: mergedSubmission.email,
    status: "PENDING",
    statusNotes: existing.statusNotes,
  });
  if (updateResult.errors?.length) throw new Error(updateResult.errors.map((e) => e.message).join(", "));
  return updateResult.data!;
}

async function handleStatusUpdate(
  identity: AppSyncIdentity,
  args: { id: string; status: Status; statusNotes?: string | null }
): Promise<Reservation> {
  if (!args?.id) throw new Error("Reservation id is required.");
  if (!args?.status) throw new Error("Status is required.");
  const { data: existing, errors } = await pclabReservations.get({ id: args.id });
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
  if (!existing) throw new Error("Reservation not found.");
  const previousStatus = existing.status as Status | undefined;
  const reviewerName = getIdentityName(identity) || "Reviewer";
  const reviewerEmail = getIdentityEmail(identity);
  const actorSub = identity.sub || identity.username || "unknown";
  const actorGroups = extractGroupsFromIdentity(identity);
  const updateResult = await pclabReservations.update({
    id: existing.id,
    status: args.status,
    statusNotes: args.statusNotes ?? existing.statusNotes,
    reviewedBySub: identity.sub || identity.username || existing.reviewedBySub,
    reviewedByName: reviewerName,
    reviewedAt: new Date().toISOString(),
  });
  if (updateResult.errors?.length) throw new Error(updateResult.errors.map((e) => e.message).join(", "));
  const updated = updateResult.data!;
  await recordReservationEvent({
    reservation: updated,
    actorSub,
    actorName: reviewerName,
    actorEmail: reviewerEmail,
    actorGroups,
    oldStatus: previousStatus,
    newStatus: args.status,
    notes: args.statusNotes ?? undefined,
  });
  await notifyOnStatusChange(updated, previousStatus);
  return updated;
}

export const handler: Handler = async (event): Promise<Reservation> => {
  const identity: AppSyncIdentity = ((event as any)?.identity || {}) as AppSyncIdentity;
  const args = ((event as any)?.arguments || {}) as Record<string, any>;
  const input = args?.input;

  if (input && typeof input === "object") {
    if ("action" in input || "id" in input) {
      return handleOwnerUpdate(identity, input as UpdateInput);
    }
    return handleCreate(identity, input as SubmissionInput);
  }

  if (args?.id && args?.status) {
    return handleStatusUpdate(identity, args as { id: string; status: Status; statusNotes?: string | null });
  }

  throw new Error("Unsupported invocation payload");
};
