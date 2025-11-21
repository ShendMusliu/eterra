import { defineFunction } from "@aws-amplify/backend";

export const adminGetUserProfile = defineFunction({
  name: "admin-get-user-profile",
  entry: "./index.ts",
});
