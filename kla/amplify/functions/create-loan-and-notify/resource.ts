import { defineFunction } from "@aws-amplify/backend";

export const createLoanAndNotify = defineFunction({
  name: "create-loan-and-notify",
  entry: "./index.ts",
  environment: {
    APP_BASE_URL: process.env.APP_BASE_URL ?? "",
    SES_SENDER: process.env.SES_SENDER ?? "",
    ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? "",
    SES_TEMPLATE_NAME: process.env.SES_TEMPLATE_NAME ?? "",
  },
});

