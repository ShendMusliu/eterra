import { defineStorage } from "@aws-amplify/backend";

/**
 * Final, Gen 2–compatible storage policy for your use case:
 * - Guests (unauth) can ONLY upload to incoming/forms/resumes/*
 * - Staff (Admin, HR) can list & get under incoming/forms/*
 * - Public read-only assets live under public/read/*
 * - Private & protected areas for signed-in users
 *
 * Notes from the docs:
 *  - Actions must be chosen from: "get" | "list" | "write" | "delete"
 *  - "read" is a shortcut for ("get" + "list") — don't mix "read" with "get" or "list" on the same rule
 *  - Paths must NOT start with "/" and must end with "/*"
 */
export const storage = defineStorage({
  name: "uploads",
  access: (allow) => ({
    // Signed-in users
    "private/*":   [allow.authenticated.to(["get", "list", "write", "delete"])],
    "protected/*": [allow.authenticated.to(["get", "list", "write"])],

    // Public read-only assets (never store PII here)
    "public/read/*": [
      allow.guest.to(["get"]),
      allow.authenticated.to(["get"]),
    ],

    // Anonymous form uploads (write-only for guests) — keep this prefix narrow
    "incoming/forms/resumes/*": [
      allow.guest.to(["write"]),
      allow.authenticated.to(["write"]),
    ],

    // Staff review area: signed-in Admin/HR can list & fetch any incoming forms
    "incoming/forms/*": [
      allow.groups(["Admin", "HR"]).to(["get", "list"]),
    ],
    "protected/admin/student-profile-imports/*": [
      allow.groups(["Admin", "HR"]).to(["get", "list"]),
    ],
  }),
});
