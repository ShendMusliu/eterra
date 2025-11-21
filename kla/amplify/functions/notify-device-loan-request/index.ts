import type { Handler } from "aws-lambda";
import type { Schema } from "../../data/resource";

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/notify-device-loan-request";
import { SESClient, SendEmailCommand, SendTemplatedEmailCommand } from "@aws-sdk/client-ses";
import {
  CognitoIdentityProviderClient,
  ListUsersInGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type {
  AttributeType,
  ListUsersInGroupCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";

// Configure Amplify Data client for this Lambda
const dataEnv = {
  ...env,
  AMPLIFY_DATA_DEFAULT_NAME: process.env.AMPLIFY_DATA_DEFAULT_NAME ?? "",
};
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

export const handler: Handler = async (event) => {
  const id: string | undefined = event?.arguments?.id;
  if (!id) throw new Error("Missing required argument 'id'");

  // Extract caller identity (Cognito user)
  const identity: any = (event as any).identity || {};
  const callerSub: string | undefined = identity?.sub || identity?.username;
  const callerGroups: string[] = Array.isArray(identity?.groups)
    ? identity.groups
    : (identity?.claims?.["cognito:groups"] as string[]) || [];

  console.log("notifyDeviceLoanRequest invoked", {
    id,
    callerSub,
    callerGroups,
    hasEnv: {
      APP_BASE_URL: !!getEnv("APP_BASE_URL"),
      SES_SENDER: !!getEnv("SES_SENDER"),
      ADMIN_EMAILS: !!getEnv("ADMIN_EMAILS"),
    },
  });

  // Load the request
  const { data: loan, errors } = await client.models.DeviceLoanRequest.get({ id });
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
  if (!loan) throw new Error("DeviceLoanRequest not found");

  // Authorize: caller must be owner (by requesterId) or in Admin/ITAdmins groups
  const groupsLower = new Set((callerGroups || []).map((g) => String(g).toLowerCase()));
  const isPrivileged = groupsLower.has("admin") || groupsLower.has("itadmins") || groupsLower.has("it");
  const isOwner = callerSub && loan.requesterId && String(loan.requesterId) === String(callerSub);
  if (!isPrivileged && !isOwner) {
    console.warn("Authorization failed for notifyDeviceLoanRequest", { callerSub, requesterId: loan.requesterId });
    throw new Error("Not authorized to notify for this request");
  }

  // Email config
  const appBaseUrl = getEnv("APP_BASE_URL", true)!;
  const sender = getEnv("SES_SENDER", true)!;
  const templateName = getEnv("SES_TEMPLATE_NAME");
  // Start with ADMIN_EMAILS if configured
  const adminEmailsCsv = getEnv("ADMIN_EMAILS");
  const recipients = new Set<string>(
    (adminEmailsCsv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  // Look up members of Cognito group ITAdmins in the pool
  const userPoolId = getEnv("USER_POOL_ID", true)!;
  try {
    let nextToken: string | undefined = undefined;
    do {
      const out: ListUsersInGroupCommandOutput = await cognito.send(
        new ListUsersInGroupCommand({
          GroupName: "ITAdmins",
          UserPoolId: userPoolId,
          Limit: 60,
          NextToken: nextToken,
        })
      );
      for (const u of out.Users || []) {
        const emailAttr = (u.Attributes || []).find((a: AttributeType | undefined) => a?.Name === "email");
        const emailVal = (emailAttr?.Value || "").trim();
        if (emailVal) recipients.add(emailVal);
      }
      nextToken = out.NextToken;
    } while (nextToken);
  } catch (e) {
    console.warn("Failed to list ITAdmins from Cognito; proceeding with ADMIN_EMAILS only", (e as any)?.message || e);
  }

  const recipientList = Array.from(recipients);
  if (!recipientList.length) {
    throw new Error("No ADMIN_EMAILS configured; set env ADMIN_EMAILS to comma-separated emails");
  }

  const link = `${appBaseUrl.replace(/\/$/, "")}/dashboard/device-loan`;

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
          <tr><td style="padding:4px 8px;color:#555">Name</td><td style="padding:4px 8px">${escapeHtml(
            loan.fullName || ""
          )}</td></tr>
          <tr><td style="padding:4px 8px;color:#555">Email</td><td style="padding:4px 8px">${escapeHtml(
            loan.email || ""
          )}</td></tr>
          ${loan.grade ? `<tr><td style="padding:4px 8px;color:#555">Grade</td><td style="padding:4px 8px">${escapeHtml(
            loan.grade
          )}</td></tr>` : ""}
          <tr><td style="padding:4px 8px;color:#555">Borrow</td><td style="padding:4px 8px">${escapeHtml(
            loan.borrowDate || ""
          )}</td></tr>
          <tr><td style="padding:4px 8px;color:#555">Return</td><td style="padding:4px 8px">${escapeHtml(
            loan.returnDate || ""
          )}</td></tr>
          <tr><td style="padding:4px 8px;color:#555">Reason</td><td style="padding:4px 8px">${escapeHtml(
            loan.reason || ""
          )}</td></tr>
          <tr><td style="padding:4px 8px;color:#555">Submitted</td><td style="padding:4px 8px">${escapeHtml(
            submittedAt
          )}</td></tr>
        </tbody>
      </table>
      <div style="margin:16px 0 0">
        <a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px">Review Request</a>
      </div>
    </div>`;

  // Send one email per recipient (to avoid exposing others via To:)
  const templateData = {
    locale: ((event as any)?.identity?.claims?.locale as string) || "en",
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
  for (const to of recipientList) {
    try {
      const resp = templateName
        ? await ses.send(
            new SendTemplatedEmailCommand({
              Source: sender,
              Destination: { ToAddresses: [to] },
              Template: templateName,
              TemplateData: JSON.stringify(templateData),
            })
          )
        : await ses.send(
            new SendEmailCommand({
              Source: sender,
              Destination: { ToAddresses: [to] },
              Message: {
                Subject: { Data: subject },
                Body: { Text: { Data: bodyText }, Html: { Data: bodyHtml } },
              },
            })
          );
      console.log("SES send success", { to, messageId: (resp as any)?.MessageId || null });
    } catch (err: any) {
      console.error("SES send failed", { to, err: err?.message || String(err) });
      throw err;
    }
  }

  return true;
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
