// Simple TypeScript handler to prove the plumbing works
export const handler = async (_event: unknown) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello from KLA Functions 👋" }),
    headers: { "content-type": "application/json" },
  };
};
