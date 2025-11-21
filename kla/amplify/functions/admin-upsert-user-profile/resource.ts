import { defineFunction } from "@aws-amplify/backend";

export const adminUpsertUserProfile = defineFunction({
  name: "admin-upsert-user-profile",
  entry: "./index.ts",
});
