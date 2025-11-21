import { useCallback, useEffect, useMemo, useState } from "react";
import { Hub } from "aws-amplify/utils";
import { fetchAuthSession } from "aws-amplify/auth";
import type { UserRole } from "../../shared/userRoles";
import type { AppPermission } from "../../shared/accessControl";
import { extractRolesFromSession, rolesToPermissions } from "@/lib/auth/roles";

export type UseUserAccessResult = {
  roles: readonly UserRole[];
  permissions: readonly AppPermission[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles?: readonly UserRole[]) => boolean;
  hasAllRoles: (roles?: readonly UserRole[]) => boolean;
  can: (permission: AppPermission) => boolean;
  canAny: (permissions?: readonly AppPermission[]) => boolean;
  canAll: (permissions?: readonly AppPermission[]) => boolean;
};

async function readAccessSnapshot() {
  const session = await fetchAuthSession();
  const roles = extractRolesFromSession(session);
  const permissions = rolesToPermissions(roles);
  return { roles, permissions };
}

export function useUserAccess(): UseUserAccessResult {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [permissions, setPermissions] = useState<AppPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await readAccessSnapshot();
      setRoles(snapshot.roles);
      setPermissions(snapshot.permissions);
    } catch (err: any) {
      console.error("useUserAccess: failed to fetch session", err);
      setError(err?.message ?? "Failed to load access claims");
      setRoles([]);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      const event = payload?.event as string | undefined;
      if (
        event === "signedIn" ||
        event === "signedOut" ||
        event === "tokenRefresh" ||
        event === "tokenRefresh_failure" ||
        event === "userDeleted"
      ) {
        load();
      }
    });
    return unsubscribe;
  }, [load]);

  const roleSet = useMemo(() => new Set<UserRole>(roles), [roles]);
  const permissionSet = useMemo(() => new Set<AppPermission>(permissions), [permissions]);

  const hasRole = useCallback((role: UserRole) => roleSet.has(role), [roleSet]);
  const hasAnyRole = useCallback(
    (wanted?: readonly UserRole[]) => {
      if (!wanted || wanted.length === 0) return true;
      return wanted.some((role) => roleSet.has(role));
    },
    [roleSet]
  );
  const hasAllRoles = useCallback(
    (wanted?: readonly UserRole[]) => {
      if (!wanted || wanted.length === 0) return true;
      return wanted.every((role) => roleSet.has(role));
    },
    [roleSet]
  );
  const can = useCallback((permission: AppPermission) => permissionSet.has(permission), [permissionSet]);
  const canAny = useCallback(
    (wanted?: readonly AppPermission[]) => {
      if (!wanted || wanted.length === 0) return true;
      return wanted.some((permission) => permissionSet.has(permission));
    },
    [permissionSet]
  );
  const canAll = useCallback(
    (wanted?: readonly AppPermission[]) => {
      if (!wanted || wanted.length === 0) return true;
      return wanted.every((permission) => permissionSet.has(permission));
    },
    [permissionSet]
  );

  return {
    roles,
    permissions,
    loading,
    error,
    reload: load,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    can,
    canAny,
    canAll,
  };
}
