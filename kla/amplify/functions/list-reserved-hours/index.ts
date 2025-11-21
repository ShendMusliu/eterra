// amplify/functions/list-reserved-hours/index.ts
import type { Handler } from "aws-lambda";
import type { Schema } from "../../data/resource";

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/list-reserved-hours";

// Ensure AMPLIFY_DATA_DEFAULT_NAME is present in env
const dataEnv = {
  ...env,
  AMPLIFY_DATA_DEFAULT_NAME: process.env.AMPLIFY_DATA_DEFAULT_NAME ?? "",
};

// Configure the Amplify client for this Lambda using the function env
const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(dataEnv);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Handler = async (event) => {
  const date: string | undefined = event?.arguments?.date;
  if (!date) { 
    throw new Error("Missing required argument 'date' (format YYYY-MM-DD).");
  }

  // Query only reservations for this date; return their hours without PII
  const { data, errors } = await client.models.Reservation.list({
    filter: { date: { eq: date } },
    limit: 200,
  });

  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }

  const hours = (data ?? [])
    .map(r => Number(r.hour))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 23);

  return hours;
};
