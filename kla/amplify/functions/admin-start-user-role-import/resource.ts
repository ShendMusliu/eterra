import { defineFunction } from "@aws-amplify/backend";

export const adminStartUserRoleImport = defineFunction({
  name: "admin-start-user-role-import",
  entry: "./index.ts",
  timeoutSeconds: 15,
  memoryMB: 512,
});
