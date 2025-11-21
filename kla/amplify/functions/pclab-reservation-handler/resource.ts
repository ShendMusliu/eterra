import { defineFunction } from "@aws-amplify/backend";

export const pclabReservationHandler = defineFunction({
  name: "pclab-reservation-handler",
  entry: "./index.ts",
  environment: {
    APP_BASE_URL: process.env.APP_BASE_URL ?? "",
    SES_SENDER: process.env.SES_SENDER ?? "",
    ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? "",
    SERVICES_EMAIL: process.env.SERVICES_EMAIL ?? "services@kla.education",
    SES_IDENTITY_ARN: process.env.SES_IDENTITY_ARN ?? "",
  },
});
