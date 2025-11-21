import { defineFunction } from "@aws-amplify/backend";

export const notifyDeviceLoanRequest = defineFunction({
  name: "notify-device-loan-request",
  entry: "./index.ts",
  // Configure optional environment variables; set values per env
  environment: {
    APP_BASE_URL: process.env.APP_BASE_URL ?? "",
    SES_SENDER: process.env.SES_SENDER ?? "",
    ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? "",
  },
});
