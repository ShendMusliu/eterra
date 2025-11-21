import React, { useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { signOut } from "aws-amplify/auth";
import { useAuthUser } from "@/hooks/useAuthUser";
import { cn } from "@/lib/utils";
import { useUserGroups } from "@/hooks/useUserGroups";

function getInitials(name?: string, fallback?: string) {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase()).join("");
  }
  if (fallback && fallback.length > 0) return fallback[0].toUpperCase();
  return "?";
}

export default function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading } = useAuthUser();
  const { hasAny } = useUserGroups();
  const canManageAdminResources = hasAny(["Admin", "ITAdmins"]);

  const displayName = useMemo(() => {
    return user?.fullName || user?.email || user?.username || "";
  }, [user]);

  const publicSiteTo = user ? "/?view=public" : "/";
  const publicSiteState = user ? { allowPublicHome: true } : undefined;

  const mainNavItems = useMemo(
    () => [
      {
        to: "/dashboard",
        label: t("header.dashboard", { defaultValue: "Dashboard" }),
        requiresAuth: true,
      },
      {
        to: publicSiteTo,
        label: t("header.publicSite", { defaultValue: "Public site" }),
        requiresAuth: false,
        state: publicSiteState,
      },
      ...(canManageAdminResources
        ? [
            {
              to: "/admin/user-roles",
              label: t("header.manageRoles", { defaultValue: "User accounts" }),
              requiresAuth: true,
            },
            {
              to: "/admin/student-profiles",
              label: t("header.manageStudentProfiles", { defaultValue: "Student profiles" }),
              requiresAuth: true,
            },
          ]
        : []),
    ],
    [publicSiteState, publicSiteTo, canManageAdminResources, t]
  );

  const visibleNavItems = useMemo(
    () => mainNavItems.filter((item) => !item.requiresAuth || user),
    [mainNavItems, user]
  );

  const [navMenuOpen, setNavMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate("/", { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-2 px-3 sm:px-6">
        {/* Brand */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <Link to={publicSiteTo} state={publicSiteState} className="flex items-center gap-2 hover:opacity-90">
            <img
              src="/kla.png"
              alt="Kosovo Leadership Academy"
              className="h-8 w-8 select-none rounded object-contain"
              draggable={false}
              decoding="async"
            />
            <span className="hidden text-sm font-semibold sm:inline">Kosovo Leadership Academy</span>
          </Link>
        </div>

        {/* Mobile navigation trigger */}
        <div className="flex flex-1 justify-center md:hidden">
          {visibleNavItems.length > 0 ? (
            <DropdownMenu open={navMenuOpen} onOpenChange={setNavMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("header.openNavigation", { defaultValue: "Open navigation" })}
                >
                  <Menu className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56 max-w-[80vw] md:hidden">
                {visibleNavItems.map((item) => (
                  <DropdownMenuItem
                    key={item.to}
                    onSelect={() => {
                      setNavMenuOpen(false);
                      navigate(item.to, { state: item.state });
                    }}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <nav
          className="hidden flex-1 items-center justify-center gap-4 md:flex"
          aria-label={t("header.primaryNav", { defaultValue: "Main navigation" })}
        >
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              state={item.state}
              className={({ isActive }) =>
                cn(
                  "rounded px-2 py-1 text-sm font-medium text-muted-foreground transition hover:text-foreground",
                  isActive && "text-foreground"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right side actions */}
        <div className="flex flex-1 items-center justify-end gap-2">
          {loading ? (
            <div className="h-9 w-28 animate-pulse rounded bg-muted" aria-hidden />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-9 items-center gap-3 rounded px-2 outline-none ring-ring/40 transition hover:bg-accent focus-visible:ring-2"
                  aria-label={t("header.openAccountMenu", { defaultValue: "Open account menu" })}
                >
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {getInitials(user.fullName, user.email || user.username)}
                  </div>
                  <div className="hidden min-w-0 flex-col text-left md:flex">
                    <span className="truncate text-sm font-medium leading-4">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t("header.signedIn", { defaultValue: "Signed in" })}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  {t("header.signedInAs", { defaultValue: "Signed in as" })}
                  <div className="mt-1 truncate text-xs text-muted-foreground">{displayName}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  {t("header.dashboard", { defaultValue: "Dashboard" })}
                </DropdownMenuItem>
                {canManageAdminResources ? (
                  <>
                    <DropdownMenuItem onClick={() => navigate("/admin/user-roles")}>
                      {t("header.manageRoles", { defaultValue: "User accounts" })}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/admin/student-profiles")}>
                      {t("header.manageStudentProfiles", { defaultValue: "Student profiles" })}
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  {t("header.profile", { defaultValue: "Profile" })}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                  {t("header.signOut", { defaultValue: "Sign out" })}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  );
}
