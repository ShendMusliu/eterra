import { defineFunction } from "@aws-amplify/backend";

export const adminUpsertRoleAssignment = defineFunction({
  name: "admin-upsert-role-assignment",
  entry: "./index.ts",
});
