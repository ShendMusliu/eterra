import { defineFunction } from "@aws-amplify/backend";

export const helloKla = defineFunction({
  name: "hello-kla",        // shows up in AWS as the Lambda name
  entry: "./index.ts",       // handler file (next step)
  // optional: runtime, memory, timeout, env, permissions — we’ll add these later
});
