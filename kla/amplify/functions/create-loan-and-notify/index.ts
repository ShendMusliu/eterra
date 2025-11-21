import type { Handler } from "aws-lambda";
import type { Schema } from "../../data/resource";

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/create-loan-and-notify";
import { SESClient, SendEmailCommand, SendTemplatedEmailCommand } from "@aws-sdk/client-ses";
import {
  CognitoIdentityProviderClient,
  ListUsersInGroupCommand,
  AdminGetUserCommand,
  AttributeType,
  ListUsersInGroupCommandOutput,
  AdminGetUserCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";

// Configure Amplify Data client for this Lambda
const dataEnv = { ...env, AMPLIFY_DATA_DEFAULT_NAME: process.env.AMPLIFY_DATA_DEFAULT_NAME ?? "" };
const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(dataEnv);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

const ses = new SESClient({});
const cognito = new CognitoIdentityProviderClient({});

function getEnv(name: string, required = false): string | undefined {
  const v = process.env[name] || (env as any)?.[name];
  if (required && !v) throw new Error(`Missing required env: ${name}`);
  return v as string | undefined;
}

async function resolveItAdminsEmails(userPoolId: string): Promise<string[]> {
  const recipients = new Set<string>();
  let nextToken: string | undefined;
  do {
    const out: ListUsersInGroupCommandOutput = await cognito.send(
      new ListUsersInGroupCommand({ GroupName: "ITAdmins", UserPoolId: userPoolId, Limit: 60, NextToken: nextToken })
    );
    for (const u of out.Users || []) {
      const emailAttr = (u.Attributes || []).find((a: AttributeType | undefined) => a?.Name === "email");
      const emailVal = (emailAttr?.Value || "").trim();
      if (emailVal) recipients.add(emailVal);
    }
    nextToken = out.NextToken;
  } while (nextToken);
  return Array.from(recipients);
}

async function resolveActorIdentity(sub: string, identity: any, userPoolId: string): Promise<{ name: string; email: string }> {
  const claims = identity?.claims || {};
  const directName = (claims.name || claims.given_name || "").toString().trim();
  const directEmail = (claims.email || "").toString().trim();
  if (directName && directEmail) {
    return { name: directName, email: directEmail };
  }
  try {
    const response: AdminGetUserCommandOutput = await cognito.send(
      new AdminGetUserCommand({ UserPoolId: userPoolId, Username: sub })
    );
    const attrMap = new Map<string, string>();
    for (const attr of response.UserAttributes || []) {
      if (attr?.Name && typeof attr.Value === "string") {
        attrMap.set(attr.Name, attr.Value);
      }
    }
    const email = directEmail || (attrMap.get("email") || "").trim();
    const derivedNameParts = [attrMap.get("name"), attrMap.get("given_name"), attrMap.get("family_name")]
      .filter((value) => typeof value === "string" && value.trim().length > 0);
    const compositeName = (directName || derivedNameParts.join(" ")).trim();
    const safeName = (compositeName || email || sub).trim();
    const safeEmail = (email || sub).trim();
    return { name: safeName, email: safeEmail };
  } catch (err) {
    console.warn("resolveActorIdentity fallback failed", err instanceof Error ? err.message : err);
    const fallbackName = (directName || directEmail || sub).trim();
    const fallbackEmail = (directEmail || sub).trim();
    return { name: fallbackName, email: fallbackEmail };
  }
}
async function sendEmailToRecipients(
  recipients: string[],
  sender: string,
  subject: string,
  bodyText: string,
  bodyHtml: string,
  templateName?: string,
  templateData?: Record<string, any>
) {
  for (const to of recipients) {
    if (templateName) {
      const cmd = new SendTemplatedEmailCommand({
        Source: sender,
        Destination: { ToAddresses: [to] },
        Template: templateName,
        TemplateData: JSON.stringify(templateData || {}),
      });
      const resp = await ses.send(cmd);
      console.log("SES SendTemplatedEmail success", { to, messageId: (resp as any)?.MessageId || null });
    } else {
      const cmd = new SendEmailCommand({
        Source: sender,
        Destination: { ToAddresses: [to] },
        Message: { Subject: { Data: subject }, Body: { Text: { Data: bodyText }, Html: { Data: bodyHtml } } },
      });
      const resp = await ses.send(cmd);
      console.log("SES SendEmail success", { to, messageId: (resp as any)?.MessageId || null });
    }
  }
}

function extractGroupsFromIdentity(identity: any): string[] {
  const tokenGroups = identity?.claims?.["cognito:groups"];
  const directGroups = Array.isArray(identity?.groups) ? identity.groups : [];
  const normalizedTokenGroups = Array.isArray(tokenGroups)
    ? tokenGroups
    : typeof tokenGroups === "string"
    ? tokenGroups.split(",")
    : [];
  const all = [...directGroups, ...normalizedTokenGroups].map((value) => String(value).trim()).filter(Boolean);
  return Array.from(new Set(all));
}

export const handler: Handler = async (event) => {

  const identity: any = (event as any).identity || {};
  const sub: string | undefined = identity?.sub || identity?.username;
  if (!sub) throw new Error("Missing caller identity");

  const userPoolId = getEnv("USER_POOL_ID", true)!;
  const appBaseUrl = getEnv("APP_BASE_URL", true)!;
  const sender = getEnv("SES_SENDER", true)!;
  const adminEmailsCsv = getEnv("ADMIN_EMAILS");
  const templateName = getEnv("SES_TEMPLATE_NAME");

  const emailFromAdminList = (adminEmailsCsv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const groupRecipients = await resolveItAdminsEmails(userPoolId);
  const recipients = Array.from(new Set([...emailFromAdminList, ...groupRecipients]));
  console.log("resolvedRecipients", { count: recipients.length });
  if (recipients.length === 0) throw new Error("No recipients resolved for ITAdmins/ADMIN_EMAILS");

  // Branch: if event.arguments has id/status -> set status; else create and notify
  const args = (event as any).arguments || {};
  const actorGroups = extractGroupsFromIdentity(identity);


  if (args?.id && args?.status) {
    // setDeviceLoanStatus
    const { id, status, notes } = args as { id: string; status: Schema["DeviceLoanStatus"]["type"]; notes?: string };
    // Load existing
    const { data: loan, errors } = await client.models.DeviceLoanRequest.get({ id });
    if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
    if (!loan) throw new Error("DeviceLoanRequest not found");
    const oldStatus = loan.status as any;

    // Update status
    const upd = await client.models.DeviceLoanRequest.update({ id, status, notes: notes ?? loan.notes ?? "" });
    if (upd.errors?.length) throw new Error(upd.errors.map((e) => e.message).join(", "));

    const updatedLoan = upd.data;
    if (!updatedLoan) throw new Error("Failed to read updated DeviceLoanRequest");

    const finalStatus = updatedLoan.status as Schema["DeviceLoanStatus"]["type"];
    const statusChanged = String(oldStatus || "") !== String(finalStatus || "");
    const previousNotes = typeof loan.notes === "string" ? loan.notes : "";
    const finalNotes = typeof updatedLoan.notes === "string" ? updatedLoan.notes : "";
    const notesChanged = previousNotes !== finalNotes;

    if (statusChanged || notesChanged) {
      const actor = await resolveActorIdentity(sub, identity, userPoolId);
      const eventRes = await client.models.DeviceLoanEvent.create({
        requestId: id,
        owner: String(loan.owner || loan.requesterId || sub),
        changedAt: new Date().toISOString(),
        changedBySub: sub,
        changedByName: actor.name,
        changedByEmail: actor.email,
        changedByGroups: actorGroups,
        oldStatus: oldStatus as any,
        newStatus: finalStatus as any,
        notes: finalNotes,
      });
      if (eventRes.errors?.length) throw new Error(eventRes.errors.map((e) => e.message).join(", "));
    }
    if (statusChanged) {
      const recipientEmail = String(updatedLoan.email || loan.email || "").trim();
      if (recipientEmail) {
        const baseUrl = appBaseUrl.replace(/\/$/, "");
        const detailPath = updatedLoan.id ? `/dashboard/device-loan/${updatedLoan.id}` : "/dashboard/device-loan";
        const link = `${baseUrl}${detailPath}`;
        const statusLabels: Record<Schema["DeviceLoanStatus"]["type"], string> = {
          PENDING: "Pending",
          APPROVED: "Approved",
          REJECTED: "Rejected",
        };
        const statusLabel = statusLabels[finalStatus] || String(finalStatus);
        const noteText = (finalNotes || "").trim();
        const greetingName = (updatedLoan.fullName || "").trim() || "there";
        const subject = `Device Loan Request Status Updated: ${statusLabel}`;
        const bodyTextLines = [
          `Hello ${greetingName},`,
          "",
          "We updated the status of your device loan request.",
          `New status: ${statusLabel}`,
          noteText ? `Reviewer notes: ${noteText}` : undefined,
          "",
          `You can review the request here: ${link}`,
          "",
          "If you have questions, reply to this email.",
        ].filter(Boolean) as string[];
        const bodyText = bodyTextLines.join("\n");
        const bodyHtml = `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111;">
            <p style="margin:0 0 12px;">Hello ${escapeHtml(greetingName)},</p>
            <p style="margin:0 0 12px;">We updated the status of your device loan request.</p>
            <p style="margin:0 0 12px;"><strong>Status:</strong> ${escapeHtml(statusLabel)}</p>
            ${noteText ? `<p style="margin:0 0 12px;"><strong>Reviewer notes:</strong> ${escapeHtml(noteText)}</p>` : ""}
            <p style="margin:0 0 12px;"><a href="${escapeHtml(link)}" style="color:#111;">View your request</a></p>
            <p style="margin:12px 0 0;">If you have questions, reply to this email.</p>
          </div>
        `;
        try {
          await sendEmailToRecipients([recipientEmail], sender, subject, bodyText, bodyHtml);
        } catch (emailErr: any) {
          console.error("Failed to send requester status email", emailErr?.message || emailErr);
        }
      } else {
        console.warn("Skipping requester email; no email on record", { requestId: id });
      }
    }

    return updatedLoan;
  }

  // createDeviceLoanAndNotify
  const { reason, borrowDate, returnDate, grade, email: emailArg, fullName: nameArg } = args as {
    reason: string;
    borrowDate: string;
    returnDate: string;
    grade?: string;
    email?: string;
    fullName?: string;
  };
  // Basic date validation server-side
  if (!borrowDate || !returnDate) throw new Error("borrowDate and returnDate are required");
  if (new Date(borrowDate).getTime() > new Date(returnDate).getTime()) {
    throw new Error("Return date must be after borrow date");
  }

  // Derive requester identity fields
  const requesterEmail: string = emailArg || identity?.claims?.email || "";
  const gn = identity?.claims?.given_name || "";
  const fn = identity?.claims?.family_name || "";
  const nameFromClaims = identity?.claims?.name || [gn, fn].filter(Boolean).join(" ");
  const requesterName: string = String(nameArg || nameFromClaims || requesterEmail || sub);

  // Create item
  const createRes = await client.models.DeviceLoanRequest.create({
    owner: sub,
    email: requesterEmail,
    fullName: requesterName,
    grade,
    reason,
    borrowDate,
    returnDate,
    status: "PENDING",
    requesterId: sub,
    notes: "",
  });
  if (createRes.errors?.length) throw new Error(createRes.errors.map((e) => e.message).join(", "));
  const loan = createRes.data!;

  // Optional: write audit event for creation
  const creationEventRes = await client.models.DeviceLoanEvent.create({
    requestId: loan.id!,
    owner: loan.owner || sub,
    changedAt: new Date().toISOString(),
    changedBySub: sub,
    changedByName: requesterName,
    changedByEmail: requesterEmail,
    changedByGroups: actorGroups,
    oldStatus: undefined as any,
    newStatus: "PENDING" as any,
    notes: "",
  });
  if (creationEventRes.errors?.length) {
    throw new Error(creationEventRes.errors.map((e) => e.message).join(", "));
  }

  // Prepare email
  const baseUrl = appBaseUrl.replace(/\/$/, "");
  const detailPath = loan.id ? `/dashboard/device-loan/${loan.id}` : "/dashboard/device-loan";
  const link = `${baseUrl}${detailPath}`;
  const locale = (identity?.claims?.locale as string) || "en";
  const subject = `New Device Loan Request: ${loan.fullName}`;
  const submittedAt = loan.createdAt || new Date().toISOString();
  const bodyText = [
    `A new device loan request was submitted.`,
    ``,
    `Name: ${loan.fullName}`,
    `Email: ${loan.email}`,
    loan.grade ? `Grade: ${loan.grade}` : undefined,
    `Borrow: ${loan.borrowDate}`,
    `Return: ${loan.returnDate}`,
    `Reason: ${loan.reason}`,
    `Submitted: ${submittedAt}`,
    ``,
    `Review and take action: ${link}`,
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111;">
      <h2 style="margin:0 0 12px">New Device Loan Request</h2>
      <table style="border-collapse: collapse">
        <tbody>
          <tr><td style=\"padding:4px 8px;color:#555\">Name</td><td style=\"padding:4px 8px\">${escapeHtml(
            loan.fullName || ""
          )}</td></tr>
          <tr><td style=\"padding:4px 8px;color:#555\">Email</td><td style=\"padding:4px 8px\">${escapeHtml(
            loan.email || ""
          )}</td></tr>
          ${loan.grade ? `<tr><td style=\"padding:4px 8px;color:#555\">Grade</td><td style=\"padding:4px 8px\">${escapeHtml(
            loan.grade
          )}</td></tr>` : ""}
          <tr><td style=\"padding:4px 8px;color:#555\">Borrow</td><td style=\"padding:4px 8px\">${escapeHtml(
            loan.borrowDate || ""
          )}</td></tr>
          <tr><td style=\"padding:4px 8px;color:#555\">Return</td><td style=\"padding:4px 8px\">${escapeHtml(
            loan.returnDate || ""
          )}</td></tr>
          <tr><td style=\"padding:4px 8px;color:#555\">Reason</td><td style=\"padding:4px 8px\">${escapeHtml(
            loan.reason || ""
          )}</td></tr>
          <tr><td style=\"padding:4px 8px;color:#555\">Submitted</td><td style=\"padding:4px 8px\">${escapeHtml(
            submittedAt
          )}</td></tr>
        </tbody>
      </table>
      <div style="margin:16px 0 0">
        <a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px">Review Request</a>
      </div>
    </div>`;

  const templateData = {
    locale,
    title: "New Device Loan Request",
    fullName: loan.fullName,
    email: loan.email,
    grade: loan.grade || "",
    borrowDate: loan.borrowDate,
    returnDate: loan.returnDate,
    reason: loan.reason,
    submittedAt,
    link,
  };

  try {
    await sendEmailToRecipients(
      recipients,
      sender,
      subject,
      bodyText,
      bodyHtml,
      templateName || undefined,
      templateData
    );
  } catch (e: any) {
    console.error("Email send failed", e?.message || e);
    // Swallow email errors to not roll back creation; or throw to fail entirely
  }

  return loan;
};

function escapeHtml(input: string): string {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default handler;



