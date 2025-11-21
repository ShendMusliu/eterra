// src/pages/public/ReserveSportsField.tsx
import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";
import { DateTime } from "luxon";
import { allowedStartHours, formatHourRange, getWindowForDate, TIMEZONE } from "@/config/reservationWindows";

import { useAuthUser } from "@/hooks/useAuthUser";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";

const client = generateClient<Schema>();

const kosovoPhonePattern = /^\+383\s\d{2}\s\d{3}\s\d{3}$/;
const MAX_PHONE_LENGTH = "+383 45 123 456".length;

function formatKosovoPhoneInput(raw: string): string {
  if (!raw) return "";

  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (!digits.startsWith("383")) {
    digits = `383${digits}`;
  }

  const rest = digits.slice(3, 11);

  if (rest.length === 0) {
    return "+383 ";
  }

  let formatted = "+383";
  const firstBlock = rest.slice(0, Math.min(2, rest.length));
  formatted += ` ${firstBlock}`;

  if (rest.length > 2) {
    const secondBlock = rest.slice(2, Math.min(5, rest.length));
    formatted += ` ${secondBlock}`;
  }

  if (rest.length > 5) {
    const thirdBlock = rest.slice(5, Math.min(8, rest.length));
    formatted += ` ${thirdBlock}`;
  }

  return formatted;
}

// --- Helpers ---
const fmtDateISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
};

// --- Validation ---
const schema = z.object({
  date: z.date({ required_error: "reserve.errors.dateRequired" }),
  hour: z.number({ required_error: "reserve.errors.hourRequired" }).min(0).max(23),
  fullName: z.string().min(2, "reserve.errors.fullNameMin").max(120, "reserve.errors.fullNameMax"),
  email: z.string().email("reserve.errors.emailInvalid"),
  phone: z
    .string()
    .optional()
    .refine(
      (value) => !value || kosovoPhonePattern.test(value.trim()),
      "reserve.errors.phoneFormat"
    ),
  comments: z.string().max(500, "reserve.errors.commentsMax").optional(),
});

type FormValues = z.infer<typeof schema>;

type CreateReservationInput = {
  date: string;
  hour: number;
  fullName: string;
  email: string;
  phone?: string | null;
  comments?: string | null;
};

type CreateReservationResult = {
  data?: unknown;
  errors?: Array<{ message?: string | null } | null> | null;
};

type CreateReservationFn = (
  input: CreateReservationInput,
  options?: { authMode?: string }
) => Promise<CreateReservationResult>;

type ReservationRecord = Schema["Reservation"]["type"];

export default function ReserveSportsField() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuthUser();

  // UI state to match the reference style
  const [openDate, setOpenDate] = useState(false);

  // Data state
  // Compute "tomorrow" in the configured timezone (start of day)
  const tzTomorrow = useMemo(
    () => DateTime.now().setZone(TIMEZONE).plus({ days: 1 }).startOf("day").toJSDate(),
    []
  );

  const [selectedDate, setSelectedDate] = useState<Date>(tzTomorrow);
  const [reservedHours, setReservedHours] = useState<Set<number>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<ReservationRecord[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const {
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: tzTomorrow,
      hour: undefined as unknown as number,
      fullName: "",
      email: "",
      phone: "+383 ",
      comments: "",
    },
  });

  const dateWatch = watch("date");
  const fullNameWatch = watch("fullName");
  const emailWatch = watch("email");
  const dateKey = useMemo(() => (dateWatch ? fmtDateISO(dateWatch) : undefined), [dateWatch]);

  useEffect(() => {
    if (!user || authLoading) return;
    const derivedName = user.fullName || [user.givenName, user.familyName].filter(Boolean).join(" ").trim();
    if (!fullNameWatch && derivedName) {
      setValue("fullName", derivedName, { shouldDirty: false });
    }
    if (!emailWatch && user.email) {
      setValue("email", user.email, { shouldDirty: false });
    }
  }, [authLoading, emailWatch, fullNameWatch, setValue, user]);

  useEffect(() => {
    if (!user) {
      setShowHistory(false);
      setHistoryItems([]);
      setHistoryLoaded(false);
      setHistoryError(null);
      setHistoryLoading(false);
    }
  }, [user]);

  // Fetch reserved hours using the public, PII-safe query
  useEffect(() => {
    let isCancelled = false;
    const fetchReserved = async () => {
      if (!dateKey) return;
      setLoadingSlots(true);
      setReservedHours(new Set());
      setErrorMsg(null);

      try {
        const { data, errors } = await client.queries.listReservedHours(
          { date: dateKey },
          { authMode: "apiKey" }
        );
        if (errors?.length) {
          throw new Error(errors.map((e: { message: string }) => e.message).join(", "));
        }
        if (!isCancelled) {
          const taken = new Set<number>(
            (Array.isArray(data) ? data : []).filter(
              (n): n is number => typeof n === "number" && Number.isFinite(n)
            )
          );
          setReservedHours(taken);
        }
      } catch (err) {
        if (!isCancelled) setErrorMsg(t("reserve.errors.loadFailed"));
        console.error("Load reserved hours failed", err);
      } finally {
        if (!isCancelled) setLoadingSlots(false);
      }
    };

    fetchReserved();
    return () => {
      isCancelled = true;
    };
  }, [dateKey, t]);

  const allowedHours = useMemo(
    () => (dateWatch ? allowedStartHours(dateWatch, 60) : []),
    [dateWatch]
  );
  async function loadMyReservations(forceRefresh: boolean = false) {
    if (!user) return;
    if (forceRefresh) {
      setHistoryLoaded(false);
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const filterParts: any[] = [];
      if (user.userId) {
        filterParts.push({ requesterId: { eq: user.userId } });
      }
      if (user.username) {
        filterParts.push({ owner: { eq: user.username } });
      }
      const filter = (
        filterParts.length === 0
          ? undefined
          : filterParts.length === 1
          ? filterParts[0]
          : { or: filterParts }
      );

      const collected: ReservationRecord[] = [];
      let nextToken: string | undefined;
      const PAGE_LIMIT = 50;
      const MAX_RESULTS = 100;

      do {
        const res: any = await client.models.Reservation.list({
          authMode: "userPool",
          filter,
          limit: PAGE_LIMIT,
          nextToken,
        } as any);
        const items = ((res?.data ?? []) as (ReservationRecord | null | undefined)[]).filter(
          (item): item is ReservationRecord => Boolean(item)
        );
        collected.push(...items);
        nextToken = (res as any)?.nextToken ?? undefined;
      } while (nextToken && collected.length < MAX_RESULTS);

      const sorted = collected
        .slice(0, MAX_RESULTS)
        .sort((a, b) => {
          const keyA = `${a.date ?? ""}-${String(a.hour ?? 0).padStart(2, "0")}`;
          const keyB = `${b.date ?? ""}-${String(b.hour ?? 0).padStart(2, "0")}`;
          return keyB.localeCompare(keyA);
        });

      setHistoryItems(sorted);
      setHistoryLoaded(true);
    } catch (err) {
      console.error("Failed to load reservations", err);
      setHistoryError(
        t("reserve.errors.loadHistory", {
          defaultValue: "Could not load your reservations right now. Please try again.",
        })
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  const freeHours = useMemo(
    () => allowedHours.filter((h) => !reservedHours.has(h)),
    [allowedHours, reservedHours]
  );

  // Preselect earliest valid slot when date or availability changes
  useEffect(() => {
    if (!dateWatch) return;
    if (freeHours.length > 0) {
      const selected = watch("hour");
      if (selected === undefined || !freeHours.includes(selected)) {
        setValue("hour", freeHours[0]);
      }
    } else {
      setValue("hour", undefined as unknown as number);
    }
  }, [dateWatch, freeHours, setValue, watch]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const dateStr = fmtDateISO(values.date);

      if (reservedHours.has(values.hour)) {
        setErrorMsg(t("reserve.errors.slotJustTaken"));
        return;
      }

      const dt = DateTime.fromISO(dateStr, { zone: TIMEZONE });
      const { startMins, endMins } = getWindowForDate(dt.toJSDate());
      const startM = values.hour * 60;
      if (!(startM >= startMins && startM + 60 <= endMins)) {
        throw new Error(
          "Bookings are available 16:00-23:00 (Mon-Fri) and 12:00-23:00 (Sat-Sun). Please pick a time within those hours."
        );
      }

      const mutations = (client as { mutations?: Record<string, unknown> }).mutations;
      const maybeCreateValidated = mutations?.["createReservationValidated"];
      if (typeof maybeCreateValidated !== "function") {
        throw new Error("Reservation service not ready. Please refresh after backend deploy.");
      }
      const createValidated = maybeCreateValidated as CreateReservationFn;
      const mutationAuthMode = user ? "userPool" : "apiKey";
      const { errors } = await createValidated(
        {
          date: dateStr,
          hour: values.hour,
          fullName: values.fullName,
          email: values.email,
          phone: values.phone?.trim() ? values.phone.trim() : undefined,
          comments: values.comments,
        },
        { authMode: mutationAuthMode }
      );
      if (errors?.length) {
        const aggregated = errors
          .map((entry) => {
            if (!entry) return "";
            const message = entry.message;
            return typeof message === "string" ? message : "";
          })
          .filter((message) => message.length > 0)
          .join(", ");
        throw new Error(aggregated || "Reservation service returned an unknown error.");
      }

      setSuccessMsg(t("reserve.success"));
      setReservedHours((prev) => new Set(prev).add(values.hour));
      setValue("hour", undefined as unknown as number);
      setValue("comments", "");
      if (user) {
        setHistoryLoaded(false);
        if (showHistory) {
          await loadMyReservations(true);
        }
      }
    } catch (err: unknown) {
      const rawMessage =
        err instanceof Error && err.message ? err.message : typeof err === "string" ? err : String(err ?? "");
      if (rawMessage.includes("ConditionalCheckFailed") || rawMessage.includes("already exists")) {
        setErrorMsg(t("reserve.errors.slotJustTaken"));
      } else if (rawMessage.includes("Bookings are available")) {
        setErrorMsg(rawMessage);
      } else if (rawMessage.includes("Reservation service not ready")) {
        setErrorMsg(t("reserve.errors.submitFailed"));
      } else {
        setErrorMsg(t("reserve.errors.submitFailed"));
      }
      console.error("Create reservation failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background min-h-screen pt-20 pb-12">
      <div className="mx-auto w-full max-w-5xl px-3 sm:px-6">
        <Card className="w-full">
          <CardContent className="px-4 py-8 sm:px-8 sm:py-10">
            <h1 className="text-3xl font-semibold mb-6">{t("reserve.title")}</h1>

            {successMsg ? (
              <div className="space-y-4 py-6">
                <p className="text-green-600 font-semibold text-lg">{successMsg}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSuccessMsg(null);
                    setErrorMsg(null);
                    reset({
                      date: selectedDate ?? new Date(),
                      hour: undefined as unknown as number,
                      fullName: "",
                      email: "",
                      phone: "",
                      comments: "",
                    });
                  }}
                  className="w-full sm:w-auto"
                >
                  {t("reserve.reset")}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" autoComplete="off">
                {/* Full Name */}
                <div>
                  <Label htmlFor="fullName" className="mb-1">{t("reserve.fullName")}</Label>
                  <Controller
                    control={control}
                    name="fullName"
                    render={({ field }) => (
                      <Input id="fullName" placeholder={t("reserve.fullNamePH")} {...field} />
                    )}
                  />
                  {errors.fullName?.message && (
                    <p className="text-xs text-destructive mt-1">{t(errors.fullName.message as string)}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="email" className="mb-1">{t("reserve.email")}</Label>
                  <Controller
                    control={control}
                    name="email"
                    render={({ field }) => (
                      <Input id="email" type="email" placeholder="name@example.com" {...field} />
                    )}
                  />
                  {errors.email?.message && (
                    <p className="text-xs text-destructive mt-1">{t(errors.email.message as string)}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <Label htmlFor="phone" className="mb-1">{t("reserve.phone")}</Label>
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field }) => (
                      <Input
                        id="phone"
                        inputMode="numeric"
                        maxLength={MAX_PHONE_LENGTH}
                        value={field.value ?? "+383 "}
                        onChange={(event) =>
                          field.onChange(formatKosovoPhoneInput(event.target.value))
                        }
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    )}
                  />
                  {errors.phone?.message && (
                    <p className="text-xs text-destructive mt-1">{t(errors.phone.message as string)}</p>
                  )}
                </div>

                {/* Date */}
                <div>
                  <Label className="mb-1">{t("reserve.date")}</Label>
                  <Controller
                    control={control}
                    name="date"
                    render={({ field }) => (
                      <Popover open={openDate} onOpenChange={setOpenDate}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between font-normal"
                          >
                            <span className="inline-flex items-center">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : t("reserve.pickDate")}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              const next = date ?? new Date();
                              field.onChange(next);
                              setSelectedDate(next);
                              setOpenDate(false);
                            }}
                            captionLayout="dropdown"
                            // Disallow selecting past days and today's date
                            fromDate={tzTomorrow}
                            disabled={{ before: tzTomorrow }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                  {errors.date?.message && (
                    <p className="text-xs text-destructive mt-1">{t(errors.date.message as string)}</p>
                  )}
                </div>

                {/* Time */}
                <div>
                  <Label className="mb-1">{t("reserve.time")}</Label>
                  <Controller
                    control={control}
                    name="hour"
                    render={({ field }) => (
                      <Select
                        value={field.value !== undefined ? String(field.value) : undefined}
                        onValueChange={(v) => field.onChange(Number(v))}
                        disabled={!dateWatch || loadingSlots || freeHours.length === 0}
                      >
                        <SelectTrigger className="w-full justify-between">
                          <SelectValue placeholder={loadingSlots ? t("reserve.loading") : t("reserve.pickTime")} />
                        </SelectTrigger>
                        <SelectContent>
                          {freeHours.length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">{t("reserve.noSlots")}</div>
                          )}
                          {freeHours.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {dateWatch ? `${formatHourRange(dateWatch, h, 60)}` : `${h}:00`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.hour?.message && (
                    <p className="text-xs text-destructive mt-1">{t(errors.hour.message as string)}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{t("reserve.hoursHint")}</p>
                </div>

                {/* Comments */}
                <div>
                  <Label htmlFor="comments" className="mb-1">
                    {t("reserve.comments")}
                    <span className="text-xs text-muted-foreground ml-2">({t("optional", "optional")})</span>
                  </Label>
                  <Controller
                    control={control}
                    name="comments"
                    render={({ field }) => (
                      <Textarea id="comments" rows={3} placeholder={t("reserve.commentsPH")} {...field} />
                    )}
                  />
                  {errors.comments?.message && (
                    <p className="text-xs text-destructive mt-1">{t(errors.comments.message as string)}</p>
                  )}
                </div>

                {/* Error banner (simple) */}
                {errorMsg && (
                  <div className="text-sm rounded-md p-3 bg-red-50 text-red-700 border border-red-200">
                    {errorMsg}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                  <Button
                    type="submit"
                    disabled={submitting || !dateWatch}
                    className="w-full sm:w-auto sm:ml-auto sm:block"
                  >
                    {submitting ? t("reserve.submitting") : t("reserve.submit")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      reset({
                        date: selectedDate ?? new Date(),
                        hour: undefined as unknown as number,
                        fullName: "",
                        email: "",
                        phone: "",
                        comments: "",
                      });
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                  >
                    {t("reserve.reset")}
                  </Button>
                  {user && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      disabled={historyLoading}
                      onClick={() => {
                        setHistoryError(null);
                        setShowHistory(true);
                        if (!historyLoaded) {
                          void loadMyReservations();
                        }
                      }}
                    >
                      {historyLoading
                        ? t("reserve.loadingHistoryButton", { defaultValue: "Loading..." })
                        : t("reserve.seeMine", { defaultValue: "See My Previous Requests" })}
                    </Button>
                  )}
                </div>
              </form>
            )}

            {/* Footer hint */}
            {!successMsg && (
              <p className="text-xs text-muted-foreground mt-6">{t("reserve.hint")}</p>
            )}
          </CardContent>
        <Dialog
          open={showHistory && !!user}
          onOpenChange={(open) => {
            setShowHistory(open);
            if (open && user) {
              setHistoryError(null);
              if (!historyLoaded) {
                void loadMyReservations();
              }
            }
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("reserve.myHistoryTitle", { defaultValue: "My Reservations" })}</DialogTitle>
              <DialogDescription>
                {t("reserve.myHistoryDescription", {
                  defaultValue: "Review your previously submitted sports field reservations.",
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {t("reserve.myHistoryHint", {
                    defaultValue: "You must be signed in to track your reservations.",
                  })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!historyLoading) {
                      void loadMyReservations(true);
                    }
                  }}
                  disabled={historyLoading}
                >
                  {historyLoading
                    ? t("reserve.loadingHistoryButton", { defaultValue: "Loading..." })
                    : t("reserve.refreshHistory", { defaultValue: "Refresh" })}
                </Button>
              </div>
              {historyError && <p className="text-sm text-destructive">{historyError}</p>}
              <div className="max-h-[50vh] overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-3 py-2">{t("reserve.history.date", { defaultValue: "Date" })}</th>
                      <th className="px-3 py-2">{t("reserve.history.time", { defaultValue: "Time" })}</th>
                      <th className="px-3 py-2">{t("reserve.history.comments", { defaultValue: "Comments" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLoading ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                          {t("reserve.loadingHistoryState", { defaultValue: "Loading your reservations..." })}
                        </td>
                      </tr>
                    ) : historyItems.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                          {t("reserve.historyEmpty", { defaultValue: "No reservations found yet." })}
                        </td>
                      </tr>
                    ) : (
                      historyItems.map((item) => {
                        const safeDate = item.date ?? "";
                        const slotDateTime = safeDate ? DateTime.fromISO(safeDate, { zone: TIMEZONE }) : null;
                        const hourValue = typeof item.hour === "number" ? item.hour : 0;
                        const dateLabel =
                          slotDateTime && slotDateTime.isValid
                            ? slotDateTime.toLocaleString(DateTime.DATE_MED)
                            : t("reserve.history.unknownDate", { defaultValue: "Unknown date" });
                        const slotLabel =
                          slotDateTime && slotDateTime.isValid
                            ? formatHourRange(slotDateTime.toJSDate(), hourValue)
                            : `${String(hourValue).padStart(2, "0")}:00`;

                        const commentLabel = item.comments?.trim()
                          ? item.comments
                          : t("reserve.history.noComment", { defaultValue: "No comments provided." });
                        const rowKey = `${safeDate}-${hourValue}-${item.requesterId ?? ""}`;
                        return (
                          <tr key={rowKey} className="border-b">
                            <td className="px-3 py-2 whitespace-nowrap">{dateLabel}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{slotLabel}</td>
                            <td className="px-3 py-2">
                              <div className="whitespace-pre-wrap text-sm leading-snug">{commentLabel}</div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </Card>
      </div>
    </div>
  );
}

/**
 * i18n keys (add to en.json and sq.json):
 * {
 *   "reserve": {
 *     "title": "Reserve Sports Field",
 *     "subtitle": "Pick a date and an available 60-minute slot.",
 *     "date": "Date",
 *     "pickDate": "Pick a date",
 *     "time": "Time",
 *     "pickTime": "Pick a time",
 *     "noSlots": "No free slots on this day.",
 *     "loading": "Loading...",
 *     "fullName": "Full name",
 *     "fullNamePH": "Ada Lovelace",
 *     "email": "Email",
 *     "phone": "Phone",
 *     "comments": "Comments",
 *     "commentsPH": "Optional notes for staff",
 *     "submit": "Reserve",
 *     "submitting": "Reserving...",
 *     "reset": "Reset",
 *     "success": "Reservation confirmed!",
 *     "hint": "Unavailable times are hidden automatically.",
 *     "seeMine": "See My Previous Requests",
 *     "loadingHistoryButton": "Loading...",
 *     "myHistoryTitle": "My Reservations",
 *     "myHistoryDescription": "Review your previously submitted sports field reservations.",
 *     "myHistoryHint": "You must be signed in to track your reservations.",
 *     "refreshHistory": "Refresh",
 *     "loadingHistoryState": "Loading your reservations...",
 *     "historyEmpty": "No reservations found yet.",
 *     "history": {
 *       "date": "Date",
 *       "time": "Time",
 *       "comments": "Comments",
 *       "noComment": "No comments provided.",
 *       "unknownDate": "Unknown date"
 *     },
 *     "errors": {
 *       "dateRequired": "Please choose a date.",
 *       "hourRequired": "Please choose a time.",
 *       "fullNameMin": "Please enter your full name.",
 *       "fullNameMax": "Name is too long.",
 *       "emailInvalid": "Please enter a valid email.",
 *       "phoneMin": "Phone number seems short.",
 *       "phoneMax": "Phone number seems long.",
 *       "commentsMax": "Comment is too long.",
 *       "loadFailed": "Failed to load available time slots. Please try again later.",
 *       "submitFailed": "Could not create the reservation.",
 *       "loadHistory": "Could not load your reservations right now. Please try again.",
 *       "slotJustTaken": "That slot was just taken. Please pick another."
 *     }
 *   },
 *   "optional": "optional"
 * }
 */
// ---------------- Sports Field Reservations ----------------


