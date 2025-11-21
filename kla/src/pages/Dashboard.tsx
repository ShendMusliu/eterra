import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useAuthUser } from "@/hooks/useAuthUser";
import { Skeleton } from "@/components/ui/skeleton";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { CalendarDays, Laptop, MonitorSmartphone, Star } from "lucide-react";
import type { AppPermission } from "../../shared/accessControl";

type Feature = {
  key: string;
  titleKey: string;
  descriptionKey: string;
  path: string;
  requiredPermissions?: readonly AppPermission[];
  icon?: React.ComponentType<{ className?: string }>;
};

type DashboardPreference = Schema["DashboardPreference"]["type"];

const FEATURES: Feature[] = [
  {
    key: "device-loan",
    titleKey: "features.deviceLoan.title",
    descriptionKey: "features.deviceLoan.description",
    path: "/dashboard/device-loan",
    icon: Laptop,
    requiredPermissions: ["deviceLoan.request"],
  },
  {
    key: "reserve-sports-field",
    titleKey: "features.reserveSportsField.title",
    descriptionKey: "features.reserveSportsField.description",
    path: "/dashboard/reserve-sports-field",
    icon: CalendarDays,
  },
  {
    key: "pc-lab-reservation",
    titleKey: "features.pcLabReservation.title",
    descriptionKey: "features.pcLabReservation.description",
    path: "/dashboard/pc-lab-reservation",
    icon: MonitorSmartphone,
    requiredPermissions: ["pcLab.request"],
  },
  // Future features can be added here with allowedGroups to restrict visibility
];

const client = generateClient<Schema>();

export default function Dashboard() {
  const { t } = useTranslation();
  const { canAny } = useUserAccess();
  const { user, loading: userLoading } = useAuthUser();

  const [q, setQ] = useState("");
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesSaving, setFavoritesSaving] = useState(false);
  const [preferenceExists, setPreferenceExists] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const ownerKey = user?.username ?? null;

  const availableFeatures = useMemo(
    () => FEATURES.filter((feature) => canAny(feature.requiredPermissions)),
    [canAny]
  );

  const persistFavorites = useCallback(
    async (nextKeys: string[]) => {
      if (!ownerKey) return;
      setFavoritesSaving(true);
      setSaveError(null);
      const payload = { owner: ownerKey, favoriteFeatureKeys: nextKeys } as const;
      let success = false;

      try {
        if (preferenceExists) {
          await client.models.DashboardPreference.update(payload, { authMode: "userPool" });
        } else {
          await client.models.DashboardPreference.create(payload, { authMode: "userPool" });
        }
        success = true;
        setPreferenceExists(true);
      } catch (primaryError) {
        if (preferenceExists) {
          try {
            await client.models.DashboardPreference.create(payload, { authMode: "userPool" });
            success = true;
            setPreferenceExists(true);
          } catch (fallbackError) {
            console.error("Failed to persist dashboard favorites", primaryError, fallbackError);
          }
        } else {
          console.error("Failed to persist dashboard favorites", primaryError);
        }
      } finally {
        setFavoritesSaving(false);
        if (!success) {
          setSaveError(
            t("dashboard.favoritesSaveError", {
              defaultValue: "We couldn't update your shortcuts. Your changes might not stick yet.",
            })
          );
        }
      }
    },
    [ownerKey, preferenceExists, t]
  );

  useEffect(() => {
    if (!ownerKey) {
      setFavoriteKeys([]);
      setPreferenceExists(false);
      setFavoritesLoading(userLoading);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setFavoritesLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const res: any = await client.models.DashboardPreference.get({ owner: ownerKey }, { authMode: "userPool" });
        if (cancelled) return;
        const data = (res?.data as DashboardPreference | null | undefined) ?? null;
        if (data && Array.isArray(data.favoriteFeatureKeys)) {
          const keys = data.favoriteFeatureKeys.filter((item): item is string => typeof item === "string");
          setFavoriteKeys(keys);
          setPreferenceExists(true);
        } else {
          setFavoriteKeys([]);
          setPreferenceExists(false);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load dashboard favorites", error);
        setFavoriteKeys([]);
        setPreferenceExists(false);
        setLoadError(
          t("dashboard.favoritesLoadError", {
            defaultValue: "We could not load your shortcuts. Try again later.",
          })
        );
      } finally {
        if (!cancelled) {
          setFavoritesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ownerKey, t, userLoading]);

  useEffect(() => {
    if (favoritesLoading) return;
    const allowedKeys = new Set(availableFeatures.map((feature) => feature.key));
    const filtered = favoriteKeys.filter((key) => allowedKeys.has(key));
    if (filtered.length !== favoriteKeys.length) {
      setFavoriteKeys(filtered);
      persistFavorites(filtered);
    }
  }, [availableFeatures, favoriteKeys, favoritesLoading, persistFavorites]);

  const favoriteSet = useMemo(() => new Set(favoriteKeys), [favoriteKeys]);
  const hasFavorites = favoriteKeys.length > 0;

  const filteredFeatures = useMemo(() => {
    if (!q) return availableFeatures;
    const term = q.toLowerCase();
    return availableFeatures.filter((feature) => {
      const title = t(feature.titleKey, { defaultValue: "" }).toLowerCase();
      const description = t(feature.descriptionKey, { defaultValue: "" }).toLowerCase();
      return title.includes(term) || description.includes(term);
    });
  }, [availableFeatures, q, t]);

  const orderedFeatures = useMemo(() => {
    if (!hasFavorites) return filteredFeatures;
    const favoritesFirst: Feature[] = [];
    const others: Feature[] = [];
    filteredFeatures.forEach((feature) => {
      if (favoriteSet.has(feature.key)) {
        favoritesFirst.push(feature);
      } else {
        others.push(feature);
      }
    });
    return [...favoritesFirst, ...others];
  }, [filteredFeatures, favoriteSet, hasFavorites]);

  const toggleFavorite = useCallback(
    (featureKey: string) => {
      setFavoriteKeys((prev) => {
        const exists = prev.includes(featureKey);
        const next = exists ? prev.filter((key) => key !== featureKey) : [...prev, featureKey];
        persistFavorites(next);
        return next;
      });
    },
    [persistFavorites]
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-3 pb-12 pt-20 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            {t("dashboard.title", { defaultValue: "Dashboard" })}
          </h1>
          <p className="text-muted-foreground">
            {t("dashboard.subtitle", {
              defaultValue: "Find and open available internal tools.",
            })}
          </p>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t("dashboard.search", { defaultValue: "Search features" })}
            className="max-w-md"
            aria-label={t("dashboard.search", { defaultValue: "Search features" })}
          />
          <Button variant="outline" onClick={() => setQ("")}>
            {t("clear", { defaultValue: "Clear" })}
          </Button>
        </div>

        {loadError ? (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}

        {saveError ? (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {saveError}
          </div>
        ) : null}

        <div className="mb-4 min-h-[1.25rem]" aria-live="polite">
          <span
            className={`inline-block text-xs text-muted-foreground transition-opacity duration-150 ${
              favoritesSaving ? "opacity-100" : "opacity-0"
            }`}
          >
            {t("dashboard.savingShortcuts", { defaultValue: "Saving your shortcuts..." })}
          </span>
        </div>

        <Separator className="mb-6" />

        {favoritesLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {Array.from({ length: 3 }).map((_, index) => (
              <Card
                key={`dashboard-skeleton-${index}`}
                className="relative overflow-hidden shadow-sm"
                aria-label={t("dashboard.loadingFeatures", { defaultValue: "Loading shortcuts..." })}
              >
                <CardContent className="flex flex-col gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-6 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : orderedFeatures.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {t("dashboard.noFeatures", { defaultValue: "No features available." })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orderedFeatures.map((feature) => {
              const Icon = feature.icon;
              const isFavorite = favoriteSet.has(feature.key);
              const toggleLabel = isFavorite
                ? t("dashboard.unpin", { defaultValue: "Unpin shortcut" })
                : t("dashboard.pin", { defaultValue: "Pin to top" });

              return (
                <Link
                  key={feature.key}
                  to={feature.path}
                  className="group block h-full rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Card className="relative flex h-full flex-col shadow-sm transition hover:shadow-md">
                    <CardContent className="relative flex h-full min-h-[150px] flex-col justify-between gap-3 px-5 pb-5 pt-10">
                      <button
                        type="button"
                        aria-label={toggleLabel}
                        title={toggleLabel}
                        aria-pressed={isFavorite}
                        disabled={favoritesLoading || favoritesSaving || !ownerKey}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (favoritesLoading || favoritesSaving || !ownerKey) return;
                          toggleFavorite(feature.key);
                        }}
                        className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Star
                          className={`h-4 w-4 transition-colors ${
                            isFavorite ? "fill-current text-primary" : "text-muted-foreground"
                          }`}
                        />
                      </button>

                      <div className="flex items-start gap-3">
                        {Icon ? (
                          <div className="rounded-md bg-primary/10 p-2 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                        ) : null}

                        <div className="space-y-1">
                          <div className="text-lg font-semibold">
                            {t(feature.titleKey, { defaultValue: "Device Loan" })}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t(feature.descriptionKey, {
                              defaultValue: "Request a device for temporary use.",
                            })}
                          </div>
                        </div>

                        <div className="min-h-[1.25rem]">
                          <span
                            className={`inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/20 transition ${
                              isFavorite ? "opacity-100" : "invisible opacity-0"
                            }`}
                            aria-hidden={!isFavorite}
                          >
                            {t("dashboard.pinnedBadge", { defaultValue: "Pinned" })}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100">
                        {t("dashboard.tapToOpen", { defaultValue: "Click to open" })}
                      </div>
                    </CardContent>
                 </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
