// amplify/functions/create-reservation/resource.ts
import { defineFunction } from "@aws-amplify/backend";

export const createReservation = defineFunction({
  name: "create-reservation",
  entry: "./index.ts",
});
