//amplify/functions/list-reserved-hours/resource.ts

import { defineFunction } from "@aws-amplify/backend";
/**
 * list-reserved-hours function
 * Exposes a minimal resolver that returns ONLY the taken hours (0..23) for a given date.
 * No PII is returned. Publicly callable via API Key.
 * Handler source at ./index.ts
 */
export const listReservedHours = defineFunction({
  name: "list-reserved-hours",
  entry: "./index.ts",
  // environment vars are optional here; Amplify will inject data source info for GraphQL
  // If you later need direct DynamoDB access, you can add bindings/permissions here.
});