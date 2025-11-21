import { defineFunction } from "@aws-amplify/backend";

export const syncUserRolesPreToken = defineFunction({
  name: "sync-user-roles-pre-token",
  entry: "./index.ts",
  resourceGroupName: "auth",
});
