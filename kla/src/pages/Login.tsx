// src/pages/Login.tsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useId } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  signInWithRedirect,
  signIn,
  getCurrentUser,
  confirmSignIn,
  resetPassword,
  confirmResetPassword,
  updateUserAttributes,
} from "aws-amplify/auth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useAuthUser } from "@/hooks/useAuthUser";

import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Loader2, LogIn, Info, ArrowRight } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email({ message: "auth.emailInvalid" }).max(254, { message: "auth.emailTooLong" }),
  password: z.string().min(1, { message: "auth.passwordRequired" }).max(256, { message: "auth.passwordTooLong" }),
});
type LoginForm = z.infer<typeof loginSchema>;

// First-time login setup: new password + profile names (all before finishing sign-in)
const setupSchema = z
  .object({
    newPassword: z.string().min(8, { message: "auth.passwordMin" }).max(256, { message: "auth.passwordTooLong" }),
    confirmPassword: z.string(),
    givenName: z.string().min(2, { message: "auth.firstNameMin" }),
    familyName: z.string().min(2, { message: "auth.lastNameMin" }),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "auth.passwordsMustMatch",
  });
type SetupForm = z.infer<typeof setupSchema>;

const resetRequestSchema = z.object({
  email: z.string().email({ message: "auth.emailInvalid" }).max(254, { message: "auth.emailTooLong" }),
});
type ResetRequestForm = z.infer<typeof resetRequestSchema>;

const resetConfirmSchema = z
  .object({
    code: z.string().min(1, { message: "auth.codeRequired" }),
    newPassword: z.string().min(8, { message: "auth.passwordMin" }).max(256, { message: "auth.passwordTooLong" }),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "auth.passwordsMustMatch",
  });
type ResetConfirmForm = z.infer<typeof resetConfirmSchema>;

function PasswordInput({
  id,
  disabled,
  register,
  autoComplete = "current-password",
}: {
  id: string;
  disabled?: boolean;
  register: ReturnType<typeof useForm<LoginForm>>["register"];
  autoComplete?: string;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        aria-describedby={`${id}-hint`}
        disabled={disabled}
        {...register("password")}
      />
      <button
        type="button"
        aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <p id={`${id}-hint`} className="sr-only">
        {t("auth.passwordHint")}
      </p>
    </div>
  );
}

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuthUser();

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [federatedLoading, setFederatedLoading] = useState(false);
  const [requireNewPassword, setRequireNewPassword] = useState(false);
  const [visitorOpen, setVisitorOpen] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetEmail, setResetEmail] = useState<string>("");
  const [setupPwVisible, setSetupPwVisible] = useState(false);
  const newPwRef = useRef<HTMLInputElement | null>(null);

  const visitorTriggerId = useId();
  const visitorContentId = useId();
  const visitorContentRef = useRef<HTMLDivElement | null>(null);
  const [visitorMaxHeight, setVisitorMaxHeight] = useState(0);
  const visitorExpanded = visitorOpen || requireNewPassword || resetMode;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const {
    register: registerSetup,
    handleSubmit: handleSubmitSetup,
    formState: { errors: setupErrors },
    reset: resetSetup,
  } = useForm<SetupForm>({ resolver: zodResolver(setupSchema) });

  // Merge refs to avoid duplicate `ref` prop on the new password input
  const { ref: newPasswordRegRef, ...newPasswordRegProps } = registerSetup("newPassword");

  const {
    register: registerRR,
    handleSubmit: handleSubmitRR,
    formState: { errors: errorsRR },
    reset: resetRR,
  } = useForm<ResetRequestForm>({ resolver: zodResolver(resetRequestSchema) });

  const {
    register: registerRC,
    handleSubmit: handleSubmitRC,
    formState: { errors: errorsRC },
    reset: resetRC,
  } = useForm<ResetConfirmForm>({ resolver: zodResolver(resetConfirmSchema) });

  const fromPath = useMemo(() => {
    const fallback = "/dashboard";
    try {
      const p = location?.state?.from?.pathname as string | undefined;
      if (!p || p === "/" || p === "/login") {
        return fallback;
      }
      return p;
    } catch {
      return fallback;
    }
  }, [location]);

  useEffect(() => {
    // If user is already logged in, redirect them to their intended destination
    if (!authLoading && user) {
      navigate(fromPath, { replace: true });
    }
  }, [authLoading, user, navigate, fromPath]);

  // Clear setup form when requiring a new password to avoid autofill leakage
  useEffect(() => {
    if (requireNewPassword) {
      resetSetup({ newPassword: "", confirmPassword: "", givenName: "", familyName: "" });
      setSetupPwVisible(false);
      // Focus the new password field so users can start typing immediately
      setTimeout(() => newPwRef.current?.focus({ preventScroll: true }), 0);
    }
  }, [requireNewPassword, resetSetup]);

  useLayoutEffect(() => {
    const contentEl = visitorContentRef.current;
    if (!contentEl) {
      return;
    }

    if (!visitorExpanded) {
      setVisitorMaxHeight(0);
      return;
    }

    const updateHeight = () => {
      setVisitorMaxHeight(contentEl.scrollHeight);
    };

    updateHeight();

    let frame = 0;
    let observer: ResizeObserver | null = null;

    if (typeof window !== "undefined" && typeof window.ResizeObserver !== "undefined") {
      observer = new window.ResizeObserver(() => {
        if (frame) {
          window.cancelAnimationFrame(frame);
        }
        frame = window.requestAnimationFrame(updateHeight);
      });
      observer.observe(contentEl);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
      if (frame && typeof window !== "undefined") {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [visitorExpanded, requireNewPassword, resetMode, resetCodeSent, visitorOpen]);

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    setFederatedLoading(true);
    try {
      await signInWithRedirect({ provider: "Google" });
    } catch (e: any) {
      setError(e?.message || t("auth.genericError"));
      setSubmitting(false);
      setFederatedLoading(false);
    }
  };

  // Step 1: Email + temp password
  const onSubmit = async (data: LoginForm) => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await signIn({ username: data.email, password: data.password });
      const step = (res as any)?.nextStep?.signInStep;
      if (step && step !== "DONE") {
        const stepStr = String(step).toUpperCase();
        if (stepStr.includes("NEW_PASSWORD")) {
          // Ask for new password & names BEFORE completing sign-in
          setRequireNewPassword(true);
          setVisitorOpen(true);
          setSubmitting(false);
          return;
        }
        setError(t("auth.additionalStepRequired"));
        setSubmitting(false);
        return;
      }
      // Regular users (no temp password) just go in
      navigate(fromPath, { replace: true });
    } catch (e: any) {
      setError(e?.message || t("auth.invalidCredentials"));
      setSubmitting(false);
    }
  };

  // Step 2 + 3: New password + account name (before completing sign-in)
  const onSubmitSetup = async (data: SetupForm) => {
    setError(null);
    setSubmitting(true);
    try {
      // Preferred: finish NEW_PASSWORD_REQUIRED and set attributes atomically
      try {
        await confirmSignIn({
          challengeResponse: data.newPassword,
          // If supported by the library/service, set names as part of the challenge response
          // (Cognito accepts attributes during NEW_PASSWORD_REQUIRED when writable)
          // If not supported, the catch below will run a safe fallback.
          options: {
            userAttributes: {
              given_name: data.givenName,
              family_name: data.familyName,
            },
          },
        });
      } catch {
        // Fallback: complete the password step, then set attributes immediately after
        await confirmSignIn({ challengeResponse: data.newPassword });
        await updateUserAttributes({
          userAttributes: {
            given_name: data.givenName,
            family_name: data.familyName,
          },
        });
      }

      resetSetup();
      setRequireNewPassword(false);
      setSubmitting(false);
      navigate(fromPath, { replace: true });
    } catch (e: any) {
      setError(e?.message || t("auth.genericError"));
      setSubmitting(false);
    }
  };

  const onResetRequest = async (data: ResetRequestForm) => {
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword({ username: data.email });
      setResetEmail(data.email);
      setResetCodeSent(true);
      setVisitorOpen(true);
      resetRR();
      setSubmitting(false);
    } catch (e: any) {
      setError(e?.message || t("auth.genericError"));
      setSubmitting(false);
    }
  };

  const onResetConfirm = async (data: ResetConfirmForm) => {
    setError(null);
    setSubmitting(true);
    try {
      await confirmResetPassword({
        username: resetEmail,
        confirmationCode: data.code,
        newPassword: data.newPassword,
      });
      resetRC();
      setResetMode(false);
      setResetCodeSent(false);
      setSubmitting(false);
    } catch (e: any) {
      setError(e?.message || t("auth.genericError"));
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label={t("common.loading")} />
      </div>
    );
  }

  // If user is already authenticated, show loading while redirecting
  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label={t("common.loading")} />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-72 w-72 animate-blob rounded-full bg-blue-300/40 opacity-70 mix-blend-multiply blur-3xl filter" />
        <div className="animation-delay-2000 absolute -right-20 -top-20 h-72 w-72 animate-blob rounded-full bg-purple-300/40 opacity-70 mix-blend-multiply blur-3xl filter" />
        <div className="animation-delay-4000 absolute -bottom-20 left-20 h-72 w-72 animate-blob rounded-full bg-pink-300/40 opacity-70 mix-blend-multiply blur-3xl filter" />
      </div>

      {/* Floating geometric shapes */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-[20%] h-2 w-2 animate-float rounded-full bg-blue-400/60" />
        <div className="animation-delay-1000 absolute right-[15%] top-[30%] h-3 w-3 animate-float rounded-full bg-purple-400/60" />
        <div className="animation-delay-2000 absolute left-[20%] bottom-[25%] h-2 w-2 animate-float rounded-full bg-pink-400/60" />
        <div className="animation-delay-3000 absolute right-[25%] bottom-[40%] h-2.5 w-2.5 animate-float rounded-full bg-indigo-400/60" />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-2xl">
        {/* Logo and title section */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-2xl bg-white/60 p-4 shadow-lg backdrop-blur-sm ring-1 ring-black/5">
              <img src="/kla.png" alt="Kosovo Leadership Academy" className="h-16 w-16 select-none rounded-lg object-contain" draggable={false} />
            </div>
          </div>
          <h1 className="mb-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-4xl font-bold text-transparent">
            {t("auth.welcomeTitle", { defaultValue: "Welcome to KLA" })}
          </h1>
          <p className="text-sm text-slate-600">
            {t("auth.welcomeSubtitle", {
              defaultValue: "Access the tools and resources prepared for our community.",
            })}
          </p>
        </div>

        {/* Login card with glassmorphism */}
        <Card className="border-white/60 bg-white/80 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-center text-2xl">{t("auth.signIn", { defaultValue: "Sign in" })}</CardTitle>
            <CardDescription className="flex items-start justify-center gap-2 text-center">
              <Info className="mt-0.5 h-4 w-4 text-primary" />
              <span>
                {t("auth.klaGoogleOnlyNotice", {
                  defaultValue: "KLA students and staff must sign in with Google.",
                })}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {error ? (
              <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <GoogleSignInButton
              onClick={handleGoogle}
              disabled={submitting && !federatedLoading}
              loading={federatedLoading}
              aria-label={t("auth.signInWithGoogle", { defaultValue: "Sign in with Google" })}
            >
              {federatedLoading
                ? t("auth.redirecting", { defaultValue: "Redirecting…" })
                : t("auth.signInWithGoogle", { defaultValue: "Sign in with Google" })}
            </GoogleSignInButton>

            <div className="flex items-center gap-4 py-2">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {t("auth.visitorAccess", { defaultValue: "Visitor access (email & password)" })}
              </span>
              <Separator className="flex-1" />
            </div>

            <div
              className="group rounded-lg border border-border bg-muted/30 p-4 transition-all data-[expanded=true]:border-primary/50 data-[expanded=true]:bg-muted/50 data-[expanded=true]:pb-5"
              data-expanded={visitorExpanded}
            >
              <button
                id={visitorTriggerId}
                type="button"
                onClick={() => setVisitorOpen((prev) => !prev)}
                className="flex w-full select-none flex-col gap-2 text-left text-sm font-medium"
                aria-expanded={visitorExpanded}
                aria-controls={visitorContentId}
              >
                <span>
                  {requireNewPassword
                    ? t("auth.completeSetup", { defaultValue: "Complete setup: set new password & name" })
                    : t("auth.openVisitorForm", { defaultValue: "Open visitor sign-in" })}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {t("auth.forGuestsOnly", { defaultValue: "For guests and temporary accounts only" })}
                </span>
              </button>

              <div
                id={visitorContentId}
                ref={visitorContentRef}
                role="region"
                aria-hidden={!visitorExpanded}
                aria-labelledby={visitorTriggerId}
                data-expanded={visitorExpanded}
                className="mt-4 overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out data-[expanded=false]:pointer-events-none"
                style={{
                  maxHeight: visitorExpanded ? `${visitorMaxHeight}px` : "0px",
                  opacity: visitorExpanded ? 1 : 0,
                  transform: visitorExpanded ? "translateY(0)" : "translateY(-0.5rem)",
                }}
              >
                <div className="space-y-4">
                  <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                    <p>
                      {t("auth.visitorHint", {
                        defaultValue: "Do not use your school Google account. Use the visitor email provided by an administrator.",
                      })}
                    </p>
                  </div>

                  {requireNewPassword ? (
                    // New password + account name BEFORE finishing sign-in
                    <form
                      className="space-y-4"
                      onSubmit={handleSubmitSetup(onSubmitSetup)}
                      noValidate
                      autoComplete="off"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">{t("auth.newPassword", { defaultValue: "New password" })}</Label>
                        <div className="relative">
                          <Input
                            id="newPassword"
                            type={setupPwVisible ? "text" : "password"}
                            autoComplete="new-password"
                            autoCorrect="off"
                            autoCapitalize="none"
                            placeholder={t("auth.passwordExample", { defaultValue: "P@ssw0rd22?!" })}
                            aria-invalid={!!setupErrors.newPassword}
                            {...newPasswordRegProps}
                            ref={(e: HTMLInputElement | null) => {
                              newPasswordRegRef(e);
                              newPwRef.current = e;
                            }}
                            disabled={submitting}
                          />
                          <button
                            type="button"
                            aria-label={setupPwVisible ? t("auth.hidePassword") : t("auth.showPassword")}
                            aria-pressed={setupPwVisible}
                            onClick={() => setSetupPwVisible((v) => !v)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                          >
                            {setupPwVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {setupErrors.newPassword ? (
                          <p className="text-xs text-destructive" role="status">
                            {t(setupErrors.newPassword.message as any)}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {t("auth.passwordPolicyHint", { defaultValue: "Use at least 8 characters. Avoid common phrases." })}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">{t("auth.confirmPassword", { defaultValue: "Confirm password" })}</Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={setupPwVisible ? "text" : "password"}
                            autoComplete="new-password"
                            autoCorrect="off"
                            autoCapitalize="none"
                            aria-invalid={!!setupErrors.confirmPassword}
                            {...registerSetup("confirmPassword")}
                            disabled={submitting}
                          />
                          <button
                            type="button"
                            aria-label={setupPwVisible ? t("auth.hidePassword") : t("auth.showPassword")}
                            aria-pressed={setupPwVisible}
                            onClick={() => setSetupPwVisible((v) => !v)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                          >
                            {setupPwVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {setupErrors.confirmPassword ? (
                          <p className="text-xs text-destructive" role="status">
                            {t(setupErrors.confirmPassword.message as any)}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="givenName">{t("profile.firstName", { defaultValue: "First name" })}</Label>
                          <Input
                            id="givenName"
                            type="text"
                            autoComplete="given-name"
                            aria-invalid={!!setupErrors.givenName}
                            {...registerSetup("givenName")}
                            disabled={submitting}
                          />
                          {setupErrors.givenName ? (
                            <p className="text-xs text-destructive" role="status">
                              {t(setupErrors.givenName.message as any)}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="familyName">{t("profile.lastName", { defaultValue: "Last name" })}</Label>
                          <Input
                            id="familyName"
                            type="text"
                            autoComplete="family-name"
                            aria-invalid={!!setupErrors.familyName}
                            {...registerSetup("familyName")}
                            disabled={submitting}
                          />
                          {setupErrors.familyName ? (
                            <p className="text-xs text-destructive" role="status">
                              {t(setupErrors.familyName.message as any)}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <Button type="submit" className={cn("w-full", submitting && "cursor-wait")} disabled={submitting}>
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("auth.completingSetup", { defaultValue: "Completing setup…" })}
                          </>
                        ) : (
                          t("auth.confirmNewPassword", { defaultValue: "Save and continue" })
                        )}
                      </Button>
                    </form>
                  ) : resetMode ? (
                    resetCodeSent ? (
                      <form
                        className="space-y-4"
                        onSubmit={handleSubmitRC(onResetConfirm)}
                        noValidate
                        autoComplete="off"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="code">{t("auth.code", { defaultValue: "Verification code" })}</Label>
                          <Input id="code" type="text" aria-invalid={!!errorsRC.code} {...registerRC("code")} disabled={submitting} />
                          {errorsRC.code ? (
                            <p className="text-xs text-destructive" role="status">
                              {t(errorsRC.code.message as any)}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newPasswordReset">{t("auth.newPassword", { defaultValue: "New password" })}</Label>
                          <Input
                            id="newPasswordReset"
                            type="password"
                            autoComplete="new-password"
                            aria-invalid={!!errorsRC.newPassword}
                            {...registerRC("newPassword")}
                            disabled={submitting}
                          />
                          {errorsRC.newPassword ? (
                            <p className="text-xs text-destructive" role="status">
                              {t(errorsRC.newPassword.message as any)}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirmPasswordReset">{t("auth.confirmPassword", { defaultValue: "Confirm password" })}</Label>
                          <Input
                            id="confirmPasswordReset"
                            type="password"
                            autoComplete="new-password"
                            aria-invalid={!!errorsRC.confirmPassword}
                            {...registerRC("confirmPassword")}
                            disabled={submitting}
                          />
                          {errorsRC.confirmPassword ? (
                            <p className="text-xs text-destructive" role="status">
                              {t(errorsRC.confirmPassword.message as any)}
                            </p>
                          ) : null}
                        </div>
                        <Button type="submit" className={cn("w-full", submitting && "cursor-wait")} disabled={submitting}>
                          {submitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t("auth.resettingPassword", { defaultValue: "Resetting password…" })}
                            </>
                          ) : (
                            t("auth.completeReset", { defaultValue: "Update password" })
                          )}
                        </Button>
                      </form>
                    ) : (
                      <form
                        className="space-y-4"
                        onSubmit={handleSubmitRR(onResetRequest)}
                        noValidate
                        autoComplete="off"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="resetEmail">{t("auth.email", { defaultValue: "Email" })}</Label>
                          <Input
                            id="resetEmail"
                            type="email"
                            autoComplete="email"
                            aria-invalid={!!errorsRR.email}
                            {...registerRR("email")}
                            disabled={submitting}
                          />
                          {errorsRR.email ? (
                            <p className="text-xs text-destructive" role="status">
                              {t(errorsRR.email.message as any)}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <button
                            type="button"
                            onClick={() => {
                              setResetMode(false);
                              setError(null);
                            }}
                            className="underline underline-offset-2 hover:text-foreground"
                          >
                            {t("auth.backToSignIn", { defaultValue: "Back to sign in" })}
                          </button>
                        </div>
                        <Button type="submit" className={cn("w-full", submitting && "cursor-wait")} disabled={submitting}>
                          {submitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t("auth.sending", { defaultValue: "Sending…" })}
                            </>
                          ) : (
                            t("auth.sendResetCode", { defaultValue: "Send reset code" })
                          )}
                        </Button>
                      </form>
                    )
                  ) : (
                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        setVisitorOpen(true);
                        handleSubmit(onSubmit)(e);
                      }}
                      noValidate
                    >
                      <div className="space-y-2">
                        <Label htmlFor="email">{t("auth.email", { defaultValue: "Email" })}</Label>
                        <Input
                          id="email"
                          type="email"
                          autoComplete="email"
                          placeholder={t("auth.emailPlaceholder", { defaultValue: "visitor@example.com" })}
                          aria-invalid={!!errors.email}
                          {...register("email")}
                          disabled={submitting}
                        />
                        {errors.email ? (
                          <p className="text-xs text-destructive" role="status">
                            {t(errors.email.message as any)}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">{t("auth.password", { defaultValue: "Password" })}</Label>
                        <PasswordInput id="password" register={register} disabled={submitting} />
                        {errors.password ? (
                          <p className="text-xs text-destructive" role="status">
                            {t(errors.password.message as any)}
                          </p>
                        ) : null}
                      </div>

                      <Button
                        type="submit"
                        size="lg"
                        className={cn(
                          "group relative w-full overflow-hidden rounded-full bg-primary px-8 py-3 text-base font-semibold tracking-wide text-primary-foreground shadow-xl shadow-primary/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-primary/40",
                          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          submitting && "cursor-wait"
                        )}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            {t("auth.signingIn", { defaultValue: "Signing in…" })}
                          </>
                        ) : (
                          <>
                            <span
                              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                              aria-hidden="true"
                            >
                              <span className="absolute inset-y-0 left-[-40%] w-[70%] rotate-12 bg-gradient-to-r from-white/40 via-white/10 to-transparent blur-2xl" />
                            </span>
                            <LogIn className="mr-2 h-5 w-5" />
                            <span className="flex items-center gap-2">
                              {t("auth.signInCta", { defaultValue: "Sign in" })}
                              <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
                            </span>
                          </>
                        )}
                      </Button>
                      <div className="mt-2 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setVisitorOpen(true);
                            setResetMode(true);
                            setError(null);
                          }}
                          className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                          {t("auth.forgotPassword", { defaultValue: "Forgot password?" })}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t("auth.compliance", {
            defaultValue: "We respect your privacy. Data is processed according to our Privacy Policy.",
          })}
        </p>
      </div>
    </div>
  );
}
