import { defineFunction } from "@aws-amplify/backend";

export const studentProfileImportWorker = defineFunction({
  name: "student-profile-import-worker",
  entry: "./index.ts",
  timeoutSeconds: 900,
  memoryMB: 1024,
});
