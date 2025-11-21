import type { FetchAuthSessionOutput } from "aws-amplify/auth";
import { extractRolesFromSession, normalizeRoles, rolesToPermissions } from "../auth/roles";
import type { AppPermission } from "../../../shared/accessControl";

const sessionFactory = (payload: Record<string, unknown>): FetchAuthSessionOutput =>
  ({
    tokens: {
      idToken: { payload },
      accessToken: { payload: {} },
    },
  } as FetchAuthSessionOutput);

describe("auth roles helpers", () => {
  it("normalizes role casing and removes duplicates", () => {
    expect(normalizeRoles(["teacher", "Teacher", " ADMIN "])).toMatchInlineSnapshot(`
      [
        "Teacher",
        "Admin",
      ]
    `);
  });

  it("extracts roles from custom claims when cognito groups missing", () => {
    const session = sessionFactory({ app_roles: "Teacher,Admin" });
    expect(extractRolesFromSession(session)).toEqual(["Teacher", "Admin"]);
  });

  it("derives permissions from roles list", () => {
    const perms = rolesToPermissions(["Teacher"]);
    expect(perms).toContain<AppPermission>("pcLab.request");
    expect(perms).not.toContain("pcLab.manage");
  });
});
