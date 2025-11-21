import { useCallback, useEffect, useState } from "react";
import { getCurrentUser, fetchUserAttributes, fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

export type AuthUserInfo = {
  username: string;
  // Canonicalized full display name (best effort)
  fullName?: string;
  email?: string;
  // Raw parts when available
  givenName?: string;
  familyName?: string;
  // Stable user id (Cognito sub) when available
  userId?: string;
};

export function useAuthUser() {
  const [user, setUser] = useState<AuthUserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const current = await getCurrentUser();
      const attrs = await fetchUserAttributes().catch(() => ({} as any));
      const session = await fetchAuthSession().catch(() => undefined);
      const sub = (session?.tokens?.idToken?.payload?.sub as string) || undefined;

      const a: any = attrs as any;
      const given: string | undefined = a?.given_name;
      const family: string | undefined = a?.family_name;
      const joined = [given, family].filter(Boolean).join(" ").trim();
      const fullName: string | undefined = a?.name || (joined ? joined : undefined);
      const email: string | undefined = a?.email;
      const username = current?.username ?? "";

      const info: AuthUserInfo = {
        username,
        userId: sub,
        fullName: fullName || email || username, // never show GUID if email exists
        email,
        givenName: given,
        familyName: family,
      };
      setUser(info);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const off = Hub.listen("auth", ({ payload }) => {
      const evt = payload?.event as string | undefined;
      if (evt === "signedIn" || evt === "tokenRefresh") load();
      if (evt === "signedOut" || evt === "userDeleted") setUser(null);
    });
    return () => off();
  }, [load]);

  return { user, loading, reload: load };
}
