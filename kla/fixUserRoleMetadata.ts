// scripts/fixUserRoleMetadata.ts
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import outputs from "../amplify_outputs.json" assert { type: "json" };

const TARGET_ID = "c7e3982f-3e6c-4887-9b4c-f70f073c0fb2";

async function main() {
  Amplify.configure({
    ...outputs,
    API: {
      GraphQL: {
        endpoint: outputs.data.url,
        region: outputs.data.aws_region,
        defaultAuthMode: "apiKey",
        apiKey: outputs.data.api_key,
      },
    },
  });

  const client = generateClient();

  const now = Date.now();
  const { data, errors } = await client.models.UserRoleAssignment.update({
    id: TARGET_ID,
    _version: 1,
    _lastChangedAt: now,
    _deleted: false,
  });

  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }

  console.log("Updated record:", data);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
