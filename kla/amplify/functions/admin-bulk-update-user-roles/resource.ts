// amplify/functions/admin-bulk-update-user-roles/resource.ts
import { defineFunction } from "@aws-amplify/backend";

export const adminBulkUpdateUserRoles = defineFunction({
  name: "admin-bulk-update-user-roles",
  entry: "./index.ts",
  timeoutSeconds: 20,
  memoryMB: 512,
});
