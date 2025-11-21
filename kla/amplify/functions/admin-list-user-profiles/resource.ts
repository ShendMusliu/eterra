import { defineFunction } from "@aws-amplify/backend";

export const adminListUserProfiles = defineFunction({
  name: "admin-list-user-profiles",
  entry: "./index.ts",
});
