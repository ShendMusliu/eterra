// src/pages/Home.tsx
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, GraduationCap, Trophy, LogIn, ArrowRight } from "lucide-react";
import { useAuthUser } from "@/hooks/useAuthUser";
import Loader from "@/components/Loader";

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading } = useAuthUser();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const allowPublicHome = location.state?.allowPublicHome === true || searchParams.get("view") === "public";

  // Show loading spinner while auth state is being determined
  if (loading) {
    return <Loader variant="page" />;
  }

  // Redirect authenticated users to dashboard (unless explicitly viewing public site)
  if (user && !allowPublicHome) {
    return <Navigate to="/dashboard" replace />;
  }

  const publicActions = [
    {
      icon: <UserPlus className="w-10 h-10 mb-2" />,
      label: t("applyWork"),
      route: "/apply-work",
    },
    {
      icon: <GraduationCap className="w-10 h-10 mb-2" />,
      label: t("applyStudent"),
      route: "/apply-student",
    },
    {
      icon: <Trophy className="w-10 h-10 mb-2" />,
      label: t("reserveSportsField"),
      route: "/reserve-sports-field",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen justify-center items-center px-4 bg-white pt-24 pb-12 sm:pt-32 sm:pb-20">
      <h1 className="text-3xl font-bold mb-8 text-center mt-4 sm:mt-0">
        {t("appName")}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 w-full max-w-3xl">
        {publicActions.map((item) => (
          <Card
            key={item.route}
            className="group cursor-pointer hover:scale-105 transition-transform shadow-md"
            onClick={() => navigate(item.route)}
            tabIndex={0}
            role="button"
            aria-label={item.label}
          >
            <CardContent className="flex flex-col items-center py-8">
              {item.icon}
              <span className="mt-2 font-semibold text-lg text-center group-hover:underline">
                {item.label}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {!user && (
        <div className="flex flex-col items-center mt-4 mb-4 sm:mb-0">
          <div className="text-center mb-2 text-muted-foreground">
            {t("alreadyMember")}
          </div>
          <Button
            type="button"
            size="lg"
            className="group relative flex items-center gap-3 rounded-full bg-gradient-to-r from-primary to-primary/80 px-8 py-3 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition-all duration-200 hover:-translate-y-0.5 hover:from-primary/90 hover:to-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={() => navigate("/login")}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            >
              <span className="absolute inset-y-0 left-[-35%] w-[65%] rotate-12 bg-gradient-to-r from-white/40 via-white/10 to-transparent blur-2xl" />
            </span>
            <LogIn className="h-5 w-5" />
            <span className="flex items-center gap-2">
              {t("login")}
              <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}

