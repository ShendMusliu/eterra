import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useUserGroups } from "@/hooks/useUserGroups";
import Loader from "@/components/Loader";

function InfoRow({ label, value, fallback }: { label: string; value?: string | null; fallback: string }) {
  return (
    <div className="grid gap-y-1 gap-x-4 sm:grid-cols-[180px_1fr]">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="break-words text-sm text-foreground">{value ?? fallback}</div>
    </div>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const { user, loading } = useAuthUser();
  const { groups, loading: groupsLoading } = useUserGroups();

  const missingValueLabel = t("profile.notProvided", { defaultValue: "Not provided" });

  const userProfilePlaceholders = useMemo(
    () => ({
      birthdate: t("profile.birthdatePending", { defaultValue: "Not available yet" }),
      gender: t("profile.genderPending", { defaultValue: "Not available yet" }),
      position: t("profile.positionPending", { defaultValue: "Not available yet" }),
    }),
    [t]
  );

  const profileFields = useMemo(
    () => [
      {
        label: t("profile.fullName", { defaultValue: "Full name" }),
        value: user?.fullName,
      },
      {
        label: t("profile.email", { defaultValue: "Email" }),
        value: user?.email,
      },
      {
        label: t("profile.birthdate", { defaultValue: "Birthdate" }),
        value: userProfilePlaceholders.birthdate,
      },
      {
        label: t("profile.gender", { defaultValue: "Gender" }),
        value: userProfilePlaceholders.gender,
      },
      {
        label: t("profile.position", { defaultValue: "Position" }),
        value: userProfilePlaceholders.position,
      },
    ],
    [t, user?.email, user?.fullName, userProfilePlaceholders]
  );

  if (loading && !user) {
    return <Loader variant="page" message={t("profile.loading", { defaultValue: "Loading profile" })} />;
  }

  if (!user) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] w-full items-center justify-center bg-white px-4">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle>{t("profile.notSignedInTitle", { defaultValue: "Not signed in" })}</CardTitle>
            <CardDescription>
              {t("profile.notSignedInDescription", {
                defaultValue: "Sign in to view your profile details.",
              })}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="bg-white min-h-[calc(100vh-3.5rem)]">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("profile.title", { defaultValue: "Your profile" })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("profile.readOnlyHint", {
            defaultValue: "These details sync from Kosovo Leadership Academy systems and cannot be edited here yet.",
          })}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{t("profile.personalInfo", { defaultValue: "Personal information" })}</CardTitle>
            <CardDescription>
              {t("profile.personalInfoDescription", {
                defaultValue: "Information provided by your sign-in provider.",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {profileFields.map((field) => (
              <InfoRow key={field.label} label={field.label} value={field.value} fallback={missingValueLabel} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{t("profile.membership", { defaultValue: "Membership" })}</CardTitle>
            <CardDescription>
              {t("profile.membershipDescription", {
                defaultValue: "Roles determine what you can see and do in the platform.",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groupsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t("profile.loadingGroups", { defaultValue: "Loading roles" })}
              </div>
            ) : groups.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => (
                  <span
                    key={group}
                    className="rounded-full border border-muted-foreground/30 bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {group}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("profile.noGroups", { defaultValue: "No groups assigned" })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{t("profile.dataProtection", { defaultValue: "Data protection" })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            {t("profile.dataProtectionBlurb", {
              defaultValue:
                "We keep your personal data in sync with Kosovo Leadership Academy's records. Contact the administration office if something looks incorrect.",
            })}
          </p>
          <p>
            {t("profile.supportBlurb", {
              defaultValue: "Need updates made now? Email it@kla.education.",
            })}
          </p>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}





