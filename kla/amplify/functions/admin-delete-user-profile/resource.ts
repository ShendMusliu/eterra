import { defineFunction } from "@aws-amplify/backend";

export const adminDeleteUserProfile = defineFunction({
  name: "admin-delete-user-profile",
  entry: "./index.ts",
});
