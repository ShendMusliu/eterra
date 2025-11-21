import { defineFunction } from "@aws-amplify/backend";

export const userRoleImportWorker = defineFunction({
  name: "user-role-import-worker",
  entry: "./index.ts",
  timeoutSeconds: 900,
  memoryMB: 1024,
});
