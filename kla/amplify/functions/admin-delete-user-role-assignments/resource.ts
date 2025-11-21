import { defineFunction } from "@aws-amplify/backend";

export const adminDeleteUserRoleAssignments = defineFunction({
  name: "admin-delete-user-role-assignments",
  entry: "./index.ts",
  timeoutSeconds: 20,
  memoryMB: 512,
});
