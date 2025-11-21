import { defineFunction } from "@aws-amplify/backend";

export const adminSyncCognitoUsers = defineFunction({
  name: "admin-sync-cognito-users",
  entry: "./index.ts",
  timeoutSeconds: 30,
  memoryMB: 512,
});
