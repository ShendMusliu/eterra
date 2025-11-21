// amplify/functions/create-reservation/index.ts
import type { Handler } from "aws-lambda";
import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/create-reservation";

// Configure Amplify Data client
const dataEnv = { ...env, AMPLIFY_DATA_DEFAULT_NAME: process.env.AMPLIFY_DATA_DEFAULT_NAME ?? "" };
const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(dataEnv);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

const SLOT_MINUTES = 60;

const parseHHmm = (s: string | undefined, fallback: string) =>
  s && /^\d{2}:\d{2}$/.test(s) ? s : fallback;

const WD_START = parseHHmm(process.env.RES_WD_START, "16:00");
const WD_END = parseHHmm(process.env.RES_WD_END, "23:00");
const WE_START = parseHHmm(process.env.RES_WE_START, "12:00");
const WE_END = parseHHmm(process.env.RES_WE_END, "23:00");

const hhmmToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
};

// Calculate ISO weekday (1=Mon..7=Sun) from YYYY-MM-DD without relying on timezone libs
const isoWeekdayFromIsoDate = (dateISO: string): number => {
  const [yStr, mStr, dStr] = dateISO.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);
  // Zeller's congruence variant (ISO weekday)
  const a = Math.floor((14 - m) / 12);
  const y2 = y - a;
  const m2 = m + 12 * a - 2;
  const dow = (d + Math.floor((31 * m2) / 12) + y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400)) % 7;
  // Convert to ISO 1..7 (Mon..Sun)
  return dow === 0 ? 7 : dow;
};

const getWindowMinutes = (dateISO: string) => {
  const weekday = isoWeekdayFromIsoDate(dateISO); // 1=Mon..7=Sun
  const isWeekend = weekday === 6 || weekday === 7;
  const start = hhmmToMinutes(isWeekend ? WE_START : WD_START);
  const end = hhmmToMinutes(isWeekend ? WE_END : WD_END);
  return { start, end, isWeekend, weekday };
};

const OUT_OF_WINDOW_MSG =
  "Bookings are available 16:00-23:00 (Mon-Fri) and 12:00-23:00 (Sat-Sun). Please pick a time within those hours.";

export const handler: Handler = async (event) => {
  const args = event?.arguments ?? {};
  const date: string | undefined = args.date;
  const hour: number | undefined = typeof args.hour === "number" ? args.hour : Number(args.hour);
  const fullName: string | undefined = args.fullName;
  const email: string | undefined = args.email;
  const phone: string | undefined = args.phone;
  const comments: string | undefined = args.comments;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Missing or invalid 'date' (YYYY-MM-DD).");
  }
  if (!Number.isFinite(hour) || hour! < 0 || hour! > 23) {
    throw new Error("Missing or invalid 'hour' (0..23).");
  }

  const { start, end, isWeekend, weekday } = getWindowMinutes(date);
  const startM = hour! * 60;
  const ok = startM >= start && startM + SLOT_MINUTES <= end;
  if (!ok) {
    console.warn(
      JSON.stringify({
        reason: "OUT_OF_WINDOW",
        weekday,
        isWeekend,
        requested: { date, hour },
        window: { start, end },
      })
    );
    throw new Error(OUT_OF_WINDOW_MSG);
  }

  // Attach identity metadata when the caller is signed in
  const identity = ((event as any)?.identity ?? {}) as {
    username?: string;
    sub?: string;
    email?: string;
    claims?: Record<string, unknown>;
  };
  const claims = (identity.claims ?? {}) as Record<string, unknown>;
  const usernameFromIdentity =
    typeof identity.username === "string" && identity.username.length > 0
      ? identity.username
      : typeof claims["cognito:username"] === "string"
      ? String(claims["cognito:username"])
      : undefined;
  const subFromIdentity =
    typeof identity.sub === "string" && identity.sub.length > 0
      ? identity.sub
      : typeof claims["sub"] === "string"
      ? String(claims["sub"])
      : undefined;
  const emailFromIdentity =
    typeof identity.email === "string" && identity.email.length > 0
      ? identity.email
      : typeof claims["email"] === "string"
      ? String(claims["email"])
      : undefined;
  const givenName = typeof claims["given_name"] === "string" ? String(claims["given_name"]) : undefined;
  const familyName = typeof claims["family_name"] === "string" ? String(claims["family_name"]) : undefined;
  const nameFromIdentity =
    typeof claims["name"] === "string" && String(claims["name"]).length > 0
      ? String(claims["name"])
      : [givenName, familyName].filter(Boolean).join(" ").trim() || undefined;

  const createInput: Record<string, unknown> = {
    date,
    hour: hour!,
    fullName,
    email,
    phone,
    comments,
  };

  if (usernameFromIdentity || subFromIdentity) {
    createInput.owner = usernameFromIdentity ?? subFromIdentity;
  }
  if (subFromIdentity) {
    createInput.requesterId = subFromIdentity;
  }
  if (emailFromIdentity) {
    createInput.requesterEmail = emailFromIdentity;
  }
  if (nameFromIdentity) {
    createInput.requesterName = nameFromIdentity;
  }

  // Create model; identifier [date, hour] prevents overlap
  const { data, errors } = await client.models.Reservation.create(
    createInput as any,
  );
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }
  return data?.hour ?? hour!;
};
