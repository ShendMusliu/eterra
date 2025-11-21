import { useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUserAccess } from "./useUserAccess";

// Legacy alias for compatibility (normalized to lowercase)
export type AppGroup = string;

const normalize = (value: string) => value?.toLowerCase?.().trim() ?? "";

export function useUserGroups() {
  const { roles, loading, error, reload } = useUserAccess();
  const groups = useMemo(() => roles.map((role) => normalize(role)), [roles]);
  const groupSet = useMemo(() => new Set(groups), [groups]);

  const hasAny = useCallback(
    (wanted?: readonly (AppGroup | string)[]) => {
      if (!wanted || wanted.length === 0) return true;
      return wanted.some((target) => groupSet.has(normalize(String(target))));
    },
    [groupSet]
  );

  const hasAll = useCallback(
    (wanted?: readonly (AppGroup | string)[]) => {
      if (!wanted || wanted.length === 0) return true;
      return wanted.every((target) => groupSet.has(normalize(String(target))));
    },
    [groupSet]
  );

  const isAdmin = hasAny(["Admin"]);
  const isStaff = hasAny(["Staff"]);
  const isTeacher = hasAny(["Teacher"]);
  const isIT = hasAny(["IT", "ITAdmins"]);
  const isHR = hasAny(["HR"]);
  const isStudent = hasAny(["Student"]);
  const isParent = hasAny(["Parent"]);

  return {
    groups,
    groupSet,
    loading,
    error,
    reload,
    hasAny,
    hasAnyGroup: hasAny,
    hasAll,
    isAdmin,
    isStaff,
    isTeacher,
    isIT,
    isHR,
    isStudent,
    isParent,
  };
}

// Route/content guard that requires membership in groups
export function RequireGroups({
  anyOf,
  allOf,
  children,
  redirectTo,
  fallback = null,
  loadingFallback = null,
}: {
  anyOf?: readonly (AppGroup | string)[];
  allOf?: readonly (AppGroup | string)[];
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
}) {
  const { loading, hasAny, hasAll } = useUserGroups();
  const location = useLocation();

  const allowed = useMemo(() => {
    const passAny = hasAny(anyOf);
    const passAll = hasAll(allOf);
    return passAny && passAll;
  }, [anyOf, allOf, hasAny, hasAll]);

  if (loading) return <>{loadingFallback}</>;
  if (allowed) return <>{children}</>;
  if (redirectTo) return <Navigate to={redirectTo} replace state={{ from: location }} />;
  return <>{fallback}</>;
}

// Convenience wrapper for UI-only gating (e.g., hide dashboard tiles)
export function ShowForGroups({
  anyOf,
  allOf,
  children,
}: {
  anyOf?: readonly (AppGroup | string)[];
  allOf?: readonly (AppGroup | string)[];
  children: ReactNode;
}) {
  const { loading, hasAny, hasAll } = useUserGroups();
  if (loading) return null; // avoid flicker
  const ok = hasAny(anyOf) && hasAll(allOf);
  return ok ? <>{children}</> : null;
}
