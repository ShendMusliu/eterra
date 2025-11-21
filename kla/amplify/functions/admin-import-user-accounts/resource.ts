import { defineFunction } from "@aws-amplify/backend";

export const adminImportUserAccounts = defineFunction({
  name: "admin-import-user-accounts",
  entry: "./index.ts",
  timeoutSeconds: 30,      // <- increase as needed (max 30 for AppSync callers)
  memoryMB: 512, 
});
