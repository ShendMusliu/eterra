import { defineFunction } from "@aws-amplify/backend";

export const adminStartStudentProfileImport = defineFunction({
  name: "admin-start-student-profile-import",
  entry: "./index.ts",
  timeoutSeconds: 15,
  memoryMB: 512,
});
