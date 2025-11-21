import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { DateTime } from "luxon";
import { useTranslation } from "react-i18next";
import { CalendarDays, Loader2 } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";
import { useAuthUser } from "@/hooks/useAuthUser";
import { RequireGroups, useUserGroups } from "@/hooks/useUserGroups";
import Loader from "@/components/Loader";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { subscribeToPCLabQueueRefresh } from "@/lib/pclabEvents";

type Reservation = Schema["PCLabReservation"]["type"];
type Status = Schema["PCLabReservationStatus"]["type"];
type SubmissionInput = Schema["PCLabReservationSubmissionInput"]["type"];
type UpdateInput = Schema["PCLabReservationSelfUpdateInput"]["type"];
type ReservationSortKey = "reservationDate" | "startTime" | "createdAt";
type ReservationSortDir = "asc" | "desc";

const client = generateClient<Schema>();
const QUEUE_PAGE_SIZE = 8;
const HISTORY_PAGE_SIZE = 8;
const reservationStatuses: Status[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
const timeOptions = [
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
];

const schema = z
  .object({
    fullName: z.string().min(2, "Full name is required."),
    email: z.string().email("Provide a valid email."),
    reservationDate: z.date({
      required_error: "Reservation date is required.",
    }),
    startTime: z
      .string({ required_error: "Start time is required." })
      .regex(timeRegex, "Use 24-hour format HH:MM."),
    endTime: z
      .string({ required_error: "End time is required." })
      .regex(timeRegex, "Use 24-hour format HH:MM."),
    pcsNeeded: z.number().int().min(1).max(12),
    numberOfStudents: z.number().int().min(1).max(60).optional(),
    needsMonitor: z.enum(["YES", "NO"]),
    extraComments: z.string().max(500, "Keep comments under 500 characters.").optional(),
  })
  .refine(
    (values) => {
      const start = values.startTime;
      const end = values.endTime;
      if (!timeRegex.test(start) || !timeRegex.test(end)) return false;
      return start < end;
    },
    {
      path: ["endTime"],
      message: "End time must be after start time.",
    }
  );

type FormValues = z.infer<typeof schema>;

function PCLabReservationInner() {
  const { t } = useTranslation();
  const { user, loading: userLoading } = useAuthUser();
  const { hasAnyGroup } = useUserGroups();

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const [reservationsLoaded, setReservationsLoaded] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"ALL" | Status>("ALL");
  const [historySortKey, setHistorySortKey] = useState<ReservationSortKey>("createdAt");
  const [historySortDir, setHistorySortDir] = useState<ReservationSortDir>("desc");
  const [historyNextToken, setHistoryNextToken] = useState<string | undefined>(undefined);
  const [historyPrevTokens, setHistoryPrevTokens] = useState<(string | undefined)[]>([]);
  const [historyCurrentToken, setHistoryCurrentToken] = useState<string | undefined>(undefined);
  const [historyPageIndex, setHistoryPageIndex] = useState(1);
  const historyCacheRef = useRef<Record<string, { items: Reservation[]; nextToken?: string }>>({});
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showAllQueue, setShowAllQueue] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueAll, setQueueAll] = useState<Reservation[]>([]);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [queueTable, setQueueTable] = useState<Reservation[]>([]);
  const [queueTableLoading, setQueueTableLoading] = useState(false);
  const [queueTableLoaded, setQueueTableLoaded] = useState(false);
  const [queueStatusFilter, setQueueStatusFilter] = useState<"ALL" | Status>("ALL");
  const [queueSortKey, setQueueSortKey] = useState<ReservationSortKey>("createdAt");
  const [queueSortDir, setQueueSortDir] = useState<ReservationSortDir>("desc");
  const [queuePageIndex, setQueuePageIndex] = useState(1);
  const [queueTotalPages, setQueueTotalPages] = useState(1);
  const [queueTotalItems, setQueueTotalItems] = useState(0);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      reservationDate: undefined,
      startTime: "",
      endTime: "",
      pcsNeeded: 8,
      numberOfStudents: undefined,
      needsMonitor: "NO",
      extraComments: "",
    },
  });

  useEffect(() => {
    if (user?.fullName) setValue("fullName", user.fullName);
    if (user?.email) setValue("email", user.email);
  }, [user?.fullName, user?.email, setValue]);

  const pcsNeeded = watch("pcsNeeded");
  const isReviewer = useMemo(() => hasAnyGroup(["admin", "itadmins", "superadmin"]), [hasAnyGroup]);
  const queuePending = useMemo(
    () => queueAll.filter((item) => (item.status ?? "PENDING").toUpperCase() === "PENDING"),
    [queueAll]
  );
  const queuePreview = useMemo(() => queuePending.slice(0, 6), [queuePending]);
  const navigate = useNavigate();

  const resetHistoryPaging = useCallback(() => {
    setHistoryPrevTokens([]);
    setHistoryCurrentToken(undefined);
    setHistoryNextToken(undefined);
    setHistoryPageIndex(1);
    historyCacheRef.current = {};
  }, []);

  function resetQueuePaging() {
    setQueuePageIndex(1);
    setQueueTotalPages(1);
    setQueueTotalItems(0);
    setQueueTable([]);
    setQueueTableLoaded(false);
  }

  function normalizeQueueSortValue(record: Reservation, key: ReservationSortKey): number | string | null {
    if (key === "createdAt") {
      const raw = record.createdAt ? Date.parse(String(record.createdAt)) : null;
      return raw ?? null;
    }
    if (key === "reservationDate") {
      const ts = Date.parse(`${record.reservationDate}T00:00:00Z`);
      return Number.isNaN(ts) ? record.reservationDate ?? null : ts;
    }
    if (key === "startTime") {
      return record.startTime ?? null;
    }
    return null;
  }

  function sortQueue(items: Reservation[], sortKey: ReservationSortKey, sortDir: ReservationSortDir) {
    return [...items].sort((a, b) => {
      const av = normalizeQueueSortValue(a, sortKey);
      const bv = normalizeQueueSortValue(b, sortKey);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      let comparison = 0;
      if (typeof av === "number" && typeof bv === "number") {
        comparison = av - bv;
      } else {
        comparison = String(av).localeCompare(String(bv));
      }
      return sortDir === "desc" ? -comparison : comparison;
    });
  }

  const loadReservations = useCallback(
    async (
      token?: string,
      statusOverride?: "ALL" | Status,
      useCache = true,
      sortOverride?: { sortKey: ReservationSortKey; sortDir: ReservationSortDir }
    ) => {
      const requesterKey = user?.userId || user?.username;
      if (!requesterKey) {
        setReservations([]);
        setReservationsLoaded(false);
        return;
      }
      setReservationsLoading(true);
      setReservationsError(null);
      try {
        const status = statusOverride ?? historyStatusFilter;
        const sortKey = sortOverride?.sortKey ?? historySortKey;
        const sortDir = sortOverride?.sortDir ?? historySortDir;
        const cacheKey = `${requesterKey}::${status}::${token ?? "__root__"}::${sortKey}:${sortDir}`;
        if (useCache && historyCacheRef.current[cacheKey]) {
          const cached = historyCacheRef.current[cacheKey];
          setReservations(sortQueue(cached.items, sortKey, sortDir));
          setHistoryNextToken(cached.nextToken);
          setReservationsLoaded(true);
          return;
        }

        const filter: any = { requesterId: { eq: requesterKey } };
        if (status !== "ALL") {
          filter.status = { eq: status };
        }

        const aggregated: Reservation[] = [];
        let remaining = HISTORY_PAGE_SIZE;
        let nextTokenLocal: string | undefined = token;
        let safetyCounter = 0;

        while (remaining > 0) {
          const res: any = await client.models.PCLabReservation.list({
            authMode: "userPool",
            limit: Math.max(remaining, 1),
            nextToken: nextTokenLocal,
            filter,
          } as any);
          if (res.errors?.length) {
            throw new Error(res.errors.map((e: any) => e.message).join(", "));
          }
          const fetched: Reservation[] = ((res.data || []) as (Reservation | null | undefined)[]).filter(
            (item): item is Reservation => Boolean(item)
          );
          aggregated.push(...fetched);
          remaining = HISTORY_PAGE_SIZE - aggregated.length;
          nextTokenLocal = (res as any)?.nextToken ?? undefined;

          safetyCounter += 1;
          if (!nextTokenLocal || fetched.length === 0 || safetyCounter > 5) {
            break;
          }
        }

        const pageItems = aggregated.slice(0, HISTORY_PAGE_SIZE);
        const sortedItems = sortQueue(pageItems, sortKey, sortDir);
        setReservations(sortedItems);
        setHistoryNextToken(nextTokenLocal);
        setReservationsLoaded(true);
        historyCacheRef.current = {
          ...historyCacheRef.current,
          [cacheKey]: { items: pageItems, nextToken: nextTokenLocal },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load reservations.";
        setReservationsError(message);
        setReservations([]);
        setReservationsLoaded(false);
      } finally {
        setReservationsLoading(false);
      }
    },
    [
      client.models.PCLabReservation,
      historySortDir,
      historySortKey,
      historyStatusFilter,
      user?.userId,
      user?.username,
    ]
  );

  const loadQueue = useCallback(async () => {
    if (!isReviewer) return [];
    setQueueLoading(true);
    setQueueError(null);
    try {
      const collected: Reservation[] = [];
      let nextToken: string | undefined;
      do {
        const res: any = await client.models.PCLabReservation.list({
          authMode: "userPool",
          limit: 100,
          nextToken,
        });
        if (res.errors?.length) throw new Error(res.errors.map((e: any) => e.message).join(", "));
        const items = ((res.data || []) as (Reservation | null | undefined)[]).filter(
          (item): item is Reservation => Boolean(item)
        );
        collected.push(...items);
        nextToken = (res as any)?.nextToken ?? undefined;
      } while (nextToken);
      const sorted = sortQueue(collected, queueSortKey, queueSortDir);
      setQueueAll(sorted);
      setQueueLoaded(true);
      return sorted;
    } catch (error) {
      setQueueAll([]);
      setQueueLoaded(false);
      const message = error instanceof Error ? error.message : "Failed to load review queue.";
      setQueueError(message);
      throw error;
    } finally {
      setQueueLoading(false);
    }
  }, [client.models.PCLabReservation, isReviewer, queueSortDir, queueSortKey]);

  const loadQueuePage = useCallback(
    async (options?: {
      pageIndex?: number;
      statusOverride?: "ALL" | Status;
      sortOverride?: { sortKey: ReservationSortKey; sortDir: ReservationSortDir };
      sourceOverride?: Reservation[];
    }) => {
      setQueueTableLoading(true);
      try {
        const status = options?.statusOverride ?? queueStatusFilter;
        const sortKey = options?.sortOverride?.sortKey ?? queueSortKey;
        const sortDir = options?.sortOverride?.sortDir ?? queueSortDir;
        let source = options?.sourceOverride ?? queueAll;

        if (!queueLoaded && (!source || source.length === 0)) {
          source = (await loadQueue()) ?? [];
        }

        const filtered =
          status === "ALL" ? source : source.filter((item) => (item.status ?? "PENDING").toUpperCase() === status);
        const sorted = sortQueue(filtered, sortKey, sortDir);
        const totalItems = sorted.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / QUEUE_PAGE_SIZE));
        const requestedIndex = options?.pageIndex ?? queuePageIndex ?? 1;
        const clampedPageIndex = Math.min(Math.max(requestedIndex, 1), totalPages);
      	const start = (clampedPageIndex - 1) * QUEUE_PAGE_SIZE;
        const pageItems = sorted.slice(start, start + QUEUE_PAGE_SIZE);

        setQueueTable(pageItems);
        setQueueTableLoaded(true);
        setQueuePageIndex(clampedPageIndex);
        setQueueTotalPages(totalPages);
        setQueueTotalItems(totalItems);
      } finally {
        setQueueTableLoading(false);
      }
    },
    [loadQueue, queueAll, queueLoaded, queuePageIndex, queueSortDir, queueSortKey, queueStatusFilter]
  );

  const refreshQueue = useCallback(
    async (pageIndex?: number) => {
      const updateTable = typeof pageIndex === "number";
      if (updateTable) {
        setQueueTableLoaded(false);
        setQueueTableLoading(true);
      }
      try {
        const data = await loadQueue();
        if (updateTable && typeof pageIndex === "number") {
          await loadQueuePage({ pageIndex, sourceOverride: data });
        }
      } catch (error) {
        if (updateTable) {
          setQueueTableLoaded(true);
          setQueueTableLoading(false);
        }
      }
    },
    [loadQueue, loadQueuePage]
  );

  useEffect(() => {
    if (!isReviewer) return;
    resetQueuePaging();
    void refreshQueue(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReviewer]);

  useEffect(() => {
    const unsubscribe = subscribeToPCLabQueueRefresh(async () => {
      if (historyOpen && reservationsLoaded) {
        await loadReservations(historyCurrentToken, undefined, false);
      } else {
        setReservationsLoaded(false);
        resetHistoryPaging();
      }
      if (isReviewer) {
        void refreshQueue(showAllQueue ? queuePageIndex : undefined);
      }
    });
    return () => {
      unsubscribe?.();
    };
  }, [
    historyCurrentToken,
    historyOpen,
    isReviewer,
    loadReservations,
    queuePageIndex,
    refreshQueue,
    reservationsLoaded,
    resetHistoryPaging,
    showAllQueue,
  ]);

  const createReservation = useCallback(
    async (values: FormValues) => {
      const mutation = (client as any)?.mutations?.createPCLabReservationRequest;
      if (!mutation) throw new Error("Reservation service is not ready. Please try again later.");
      const payload: SubmissionInput = {
        reservationDate: format(values.reservationDate, "yyyy-MM-dd"),
        startTime: values.startTime,
        endTime: values.endTime,
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        pcsNeeded: values.pcsNeeded,
        numberOfStudents: values.numberOfStudents,
        needsMonitor: values.needsMonitor === "YES",
        extraComments: values.extraComments?.trim() || undefined,
      };
      await mutation({ input: payload }, { authMode: "userPool" });
    },
    []
  );

  const onSubmit = useCallback<SubmitHandler<FormValues>>(
    async (values) => {
      setSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(null);
      try {
        await createReservation(values);
        setSubmitSuccess(
          t("pclab.created", {
            defaultValue: "Reservation submitted! We will email you once it is reviewed.",
          })
        );
        reset({
          ...values,
          reservationDate: undefined,
          startTime: "",
          endTime: "",
          pcsNeeded: values.pcsNeeded,
          numberOfStudents: undefined,
          needsMonitor: values.needsMonitor,
          extraComments: "",
        });
        resetHistoryPaging();
        await loadReservations(undefined, undefined, false);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to submit reservation.";
        setSubmitError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [createReservation, loadReservations, reset, resetHistoryPaging, t]
  );

  const updateOwnReservation = useCallback(
    async (input: UpdateInput) => {
      const mutation = (client as any)?.mutations?.updateOwnPCLabReservation;
      if (!mutation) throw new Error("Update service is not ready. Please try again later.");
      await mutation({ input }, { authMode: "userPool" });
    },
    []
  );

  const handleCancel = useCallback(
    async (reservation: Reservation) => {
      try {
        setCancellingId(reservation.id);
        await updateOwnReservation({ id: reservation.id, action: "CANCEL" });
        setSubmitSuccess(t("pclab.cancelled", { defaultValue: "Reservation cancelled." }));
        setSubmitError(null);
        await loadReservations(historyCurrentToken, undefined, false);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to cancel reservation.";
        setSubmitError(message);
      } finally {
        setCancellingId(null);
      }
    },
    [historyCurrentToken, loadReservations, t, updateOwnReservation]
  );

  const canModifyReservation = useCallback((reservation: Reservation) => {
    if (!reservation) return false;
    if ((reservation.status as Status) !== "PENDING") return false;
    const start = DateTime.fromISO(`${reservation.reservationDate}T${reservation.startTime}`, {
      zone: "Europe/Belgrade",
    });
    return start.diffNow("minutes").minutes >= 60;
  }, []);

  const contentLoading = userLoading && !user;

  if (contentLoading) {
    return <Loader variant="page" />;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <div className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">PC Lab</p>
        <h1 className="text-3xl font-semibold">{t("pclab.title", { defaultValue: "PC Lab Reservation" })}</h1>
        <p className="text-muted-foreground">
          {t("pclab.subtitle", {
            defaultValue:
              "Request the lab for upcoming lessons. Reservations require approval and can be updated up to 1 hour before they begin.",
          })}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div>
            <h2 className="text-xl font-semibold">{t("pclab.form.title", { defaultValue: "Reservation Form" })}</h2>
            <p className="text-sm text-muted-foreground">
              {t("pclab.form.subtitle", {
                defaultValue:
                  "Fill out the details below. IT will reach out if they have questions or need to coordinate monitoring support.",
              })}
            </p>
          </div>

          {submitSuccess && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">{submitSuccess}</div>
          )}
          {submitError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{submitError}</div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t("pclab.form.fullName", { defaultValue: "Full Name" })}</Label>
                <Controller
                  name="fullName"
                  control={control}
                  render={({ field }) => <Input id="fullName" placeholder="Jane Doe" {...field} />}
                />
                {errors.fullName ? (
                  <p className="text-sm text-red-500">{errors.fullName.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("pclab.form.fullNameHint", { defaultValue: "Use the name students recognize." })}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("pclab.form.email", { defaultValue: "Email" })}</Label>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => <Input id="email" type="email" placeholder="you@kla.education" {...field} />}
                />
                {errors.email ? <p className="text-sm text-red-500">{errors.email.message}</p> : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("pclab.form.date", { defaultValue: "Reservation Date" })}</Label>
                <Controller
                  name="reservationDate"
                  control={control}
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? format(field.value, "PPP")
                            : t("pclab.form.pickDate", { defaultValue: "Pick a date" })}
                          <CalendarDays className="ml-auto h-4 w-4 opacity-70" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          selected={field.value}
                          onSelect={(date) => field.onChange(date)}
                          initialFocus
                          mode="single"
                          disabled={(date) => {
                            const now = new Date();
                            now.setHours(0, 0, 0, 0);
                            return date < now;
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {errors.reservationDate ? (
                  <p className="text-sm text-red-500">{errors.reservationDate.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("pclab.form.dateHint", { defaultValue: "Reservations must be in the future." })}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("pclab.form.startTime", { defaultValue: "Start Time" })}</Label>
                  <Controller
                    name="startTime"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="08:00" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.startTime ? <p className="text-sm text-red-500">{errors.startTime.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label>{t("pclab.form.endTime", { defaultValue: "End Time" })}</Label>
                  <Controller
                    name="endTime"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="10:00" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.endTime ? <p className="text-sm text-red-500">{errors.endTime.message}</p> : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pcsNeeded">
                    {t("pclab.form.pcsNeeded", { defaultValue: "PCs Needed" })}
                  </Label>
                  <span className="text-sm text-muted-foreground">
                    {pcsNeeded} / 12 {t("pclab.form.pcs", { defaultValue: "PCs" })}
                  </span>
                </div>
                <Controller
                  name="pcsNeeded"
                  control={control}
                  render={({ field }) => (
                    <input
                      id="pcsNeeded"
                      type="range"
                      min={1}
                      max={12}
                      step={1}
                      value={field.value}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                      className="block w-full accent-primary"
                    />
                  )}
                />
                {errors.pcsNeeded ? <p className="text-sm text-red-500">{errors.pcsNeeded.message}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {t("pclab.form.pcsHint", { defaultValue: "We have 12 seats available in the lab." })}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numberOfStudents">
                  {t("pclab.form.numberOfStudents", { defaultValue: "Number of Students" })}
                </Label>
                <Controller
                  name="numberOfStudents"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="numberOfStudents"
                      type="number"
                      min={1}
                      max={60}
                      placeholder="Optional"
                      value={typeof field.value === "number" ? String(field.value) : ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        field.onChange(value === "" ? undefined : Number(value));
                      }}
                    />
                  )}
                />
                {errors.numberOfStudents ? (
                  <p className="text-sm text-red-500">{errors.numberOfStudents.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("pclab.form.studentsHint", { defaultValue: "Helps IT prepare enough seats or monitors." })}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("pclab.form.monitor", { defaultValue: "Do you need a monitor?" })}</Label>
                <Controller
                  name="needsMonitor"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YES">{t("pclab.form.yes", { defaultValue: "Yes" })}</SelectItem>
                        <SelectItem value="NO">{t("pclab.form.no", { defaultValue: "No" })}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.needsMonitor ? <p className="text-sm text-red-500">{errors.needsMonitor.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="extraComments">
                  {t("pclab.form.extraComments", { defaultValue: "Extra Comments" })}
                </Label>
                <Controller
                  name="extraComments"
                  control={control}
                  render={({ field }) => (
                    <Textarea id="extraComments" placeholder="Any context for IT..." rows={4} {...field} />
                  )}
                />
                {errors.extraComments ? <p className="text-sm text-red-500">{errors.extraComments.message}</p> : null}
              </div>
            </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={async () => {
                if (!reservationsLoaded) {
                  resetHistoryPaging();
                  await loadReservations();
                }
                setHistoryOpen(true);
              }}
            >
              {t("pclab.history.open", { defaultValue: "View previous reservations" })}
            </Button>
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("pclab.form.submit", { defaultValue: "Submit reservation" })}
            </Button>
          </div>
          </form>
        </CardContent>
      </Card>

      <Dialog
        open={historyOpen}
        onOpenChange={(next) => {
          setHistoryOpen(next);
          if (next && !reservationsLoaded) {
            resetHistoryPaging();
            void loadReservations();
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("pclab.history.title", { defaultValue: "Your recent reservations" })}</DialogTitle>
            <DialogDescription>
              {t("pclab.history.subtitle", { defaultValue: "Track pending or approved requests at a glance." })}
            </DialogDescription>
          </DialogHeader>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                <Label htmlFor="historyStatusFilter" className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("deviceLoan.table.status", { defaultValue: "Status" })}
                </Label>
                <select
                  id="historyStatusFilter"
                  className="w-full rounded border bg-background px-2 py-1 text-sm sm:w-40"
                  value={historyStatusFilter}
                  onChange={async (event) => {
                    const nextStatus = event.target.value as "ALL" | Status;
                    setHistoryStatusFilter(nextStatus);
                    resetHistoryPaging();
                    await loadReservations(undefined, nextStatus, false);
                  }}
                >
                  <option value="ALL">{t("deviceLoan.filters.all", { defaultValue: "All" })}</option>
                  {reservationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {t(`status.${status.toLowerCase()}`, { defaultValue: status })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                <Label htmlFor="historySortBy" className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("deviceLoan.filters.sort", { defaultValue: "Sort" })}
                </Label>
                <select
                  id="historySortBy"
                  className="w-full rounded border bg-background px-2 py-1 text-sm sm:w-48"
                  value={`${historySortKey}:${historySortDir}`}
                  onChange={async (event) => {
                    const [nextSortKey, nextSortDir] = event.target.value.split(":") as [
                      ReservationSortKey,
                      ReservationSortDir,
                    ];
                    setHistorySortKey(nextSortKey);
                    setHistorySortDir(nextSortDir);
                    resetHistoryPaging();
                    await loadReservations(undefined, undefined, false, {
                      sortKey: nextSortKey,
                      sortDir: nextSortDir,
                    });
                  }}
                >
                  <option value="reservationDate:desc">
                    {t("pclab.filters.sortDateDesc", { defaultValue: "Date (newest first)" })}
                  </option>
                  <option value="reservationDate:asc">
                    {t("pclab.filters.sortDateAsc", { defaultValue: "Date (oldest first)" })}
                  </option>
                  <option value="startTime:asc">
                    {t("pclab.filters.sortTimeAsc", { defaultValue: "Start time (earlier first)" })}
                  </option>
                  <option value="startTime:desc">
                    {t("pclab.filters.sortTimeDesc", { defaultValue: "Start time (later first)" })}
                  </option>
                  <option value="createdAt:desc">
                    {t("deviceLoan.filters.newest", { defaultValue: "Recently submitted" })}
                  </option>
                  <option value="createdAt:asc">
                    {t("deviceLoan.filters.oldest", { defaultValue: "Oldest submissions" })}
                  </option>
                </select>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              {(historyPrevTokens.length > 0 || !!historyNextToken || reservations.length > 0) && (
                <span className="text-xs text-muted-foreground">
                  Page {historyPageIndex}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={historyPrevTokens.length === 0 || reservationsLoading}
                onClick={async () => {
                  if (historyPrevTokens.length === 0) return;
                  const prevToken = historyPrevTokens[historyPrevTokens.length - 1];
                  const nextStack = [...historyPrevTokens];
                  nextStack.pop();
                  setHistoryPrevTokens(nextStack);
                  setHistoryCurrentToken(prevToken);
                  setHistoryPageIndex((index) => Math.max(1, index - 1));
                  await loadReservations(prevToken);
                }}
              >
                {t("deviceLoan.prev", { defaultValue: "Prev" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={!historyNextToken || reservationsLoading}
                onClick={async () => {
                  if (!historyNextToken) return;
                  setHistoryPrevTokens((stack) => [...stack, historyCurrentToken]);
                  setHistoryCurrentToken(historyNextToken);
                  setHistoryPageIndex((index) => index + 1);
                  await loadReservations(historyNextToken);
                }}
              >
                {t("deviceLoan.next", { defaultValue: "Next" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={reservationsLoading}
                onClick={() => loadReservations(historyCurrentToken, undefined, false)}
              >
                {reservationsLoading
                  ? t("pclab.reviewQueue.loading", { defaultValue: "Loading..." })
                  : t("refresh", { defaultValue: "Refresh" })}
              </Button>
            </div>
          </div>
          {reservationsError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {reservationsError}
            </div>
          ) : null}
          <div className="min-h-[50vh] max-h-[60vh] overflow-auto">
            {reservationsLoading && !reservationsLoaded ? (
              <div className="flex h-full items-center justify-center py-10 text-sm text-muted-foreground">
                {t("pclab.history.loading", { defaultValue: "Loading..." })}
              </div>
            ) : (
              <HistoryTable
                items={reservations}
                emptyLabel={t("pclab.history.empty", {
                  defaultValue: "No reservations yet. Submit your first request above.",
                })}
                onViewDetails={(reservation) => {
                  setHistoryOpen(false);
                  navigate(`/dashboard/pc-lab-reservations/${reservation.id}`);
                }}
                canModifyReservation={canModifyReservation}
                onCancel={handleCancel}
                cancellingId={cancellingId}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showAllQueue}
        onOpenChange={(next) => {
          setShowAllQueue(next);
          if (next) {
            resetQueuePaging();
            void refreshQueue(1);
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <DialogTitle>{t("pclab.reviewQueue.title", { defaultValue: "Review Queue" })}</DialogTitle>
            <DialogDescription>
              {t("pclab.reviewQueue.subtitle", {
                defaultValue: "Pending PC Lab reservations awaiting approval.",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-4 shrink-0">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                <Label htmlFor="queueStatusFilter" className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("deviceLoan.table.status", { defaultValue: "Status" })}
                </Label>
                <select
                  id="queueStatusFilter"
                  className="w-full rounded border bg-background px-2 py-1 text-sm sm:w-40"
                  value={queueStatusFilter}
                  onChange={async (e) => {
                    const val = e.target.value as "ALL" | Status;
                    setQueueStatusFilter(val);
                    resetQueuePaging();
                    await loadQueuePage({ pageIndex: 1, statusOverride: val });
                  }}
                >
                  <option value="ALL">{t("deviceLoan.filters.all", { defaultValue: "All" })}</option>
                  {reservationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {t(`status.${status.toLowerCase()}`, { defaultValue: status })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                <Label htmlFor="queueSortBy" className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("deviceLoan.filters.sort", { defaultValue: "Sort" })}
                </Label>
                <select
                  id="queueSortBy"
                  className="w-full rounded border bg-background px-2 py-1 text-sm sm:w-48"
                  value={`${queueSortKey}:${queueSortDir}`}
                  onChange={async (e) => {
                    const [key, dir] = e.target.value.split(":") as [ReservationSortKey, ReservationSortDir];
                    setQueueSortKey(key);
                    setQueueSortDir(dir);
                    resetQueuePaging();
                    await loadQueuePage({ pageIndex: 1, sortOverride: { sortKey: key, sortDir: dir } });
                  }}
                >
                  <option value="reservationDate:desc">
                    {t("pclab.filters.sortDateDesc", { defaultValue: "Date (newest first)" })}
                  </option>
                  <option value="reservationDate:asc">
                    {t("pclab.filters.sortDateAsc", { defaultValue: "Date (oldest first)" })}
                  </option>
                  <option value="startTime:asc">
                    {t("pclab.filters.sortTimeAsc", { defaultValue: "Start time (earlier first)" })}
                  </option>
                  <option value="startTime:desc">
                    {t("pclab.filters.sortTimeDesc", { defaultValue: "Start time (later first)" })}
                  </option>
                </select>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              {queueTableLoaded && queueTotalItems > 0 && (
                <span className="text-xs text-muted-foreground">
                  {t("deviceLoan.pageInfo", {
                    defaultValue: "Page {{page}} of {{pages}} ({{total}} total)",
                    page: queuePageIndex,
                    pages: queueTotalPages,
                    total: queueTotalItems,
                  })}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={queueTableLoading || queueTotalItems === 0 || queuePageIndex <= 1}
                onClick={() => {
                  if (queuePageIndex <= 1) return;
                  void loadQueuePage({ pageIndex: queuePageIndex - 1 });
                }}
              >
                {t("deviceLoan.prev", { defaultValue: "Prev" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={queueTableLoading || queueTotalItems === 0 || queuePageIndex >= queueTotalPages}
                onClick={() => {
                  if (queuePageIndex >= queueTotalPages) return;
                  void loadQueuePage({ pageIndex: queuePageIndex + 1 });
                }}
              >
                {t("deviceLoan.next", { defaultValue: "Next" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={queueTableLoading}
                onClick={() => void refreshQueue(queuePageIndex)}
              >
                {queueTableLoading
                  ? t("pclab.reviewQueue.loading", { defaultValue: "Loading..." })
                  : t("refresh", { defaultValue: "Refresh" })}
              </Button>
            </div>
          </div>
          {queueError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{queueError}</div>
          )}
        </div>
          <div className="flex-1 min-h-0 px-6 pb-6">
            <div className="h-full overflow-auto">
              {queueTableLoading && !queueTableLoaded ? (
                <div className="flex h-full items-center justify-center py-10 text-sm text-muted-foreground">
                  {t("pclab.reviewQueue.loading", { defaultValue: "Loading..." })}
                </div>
              ) : (
                <QueueTable
                  items={queueTable}
                  emptyLabel={t("pclab.reviewQueue.empty", { defaultValue: "No pending reservations right now." })}
                  onViewDetails={(reservation) => navigate(`/dashboard/pc-lab-reservations/${reservation.id}`)}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isReviewer && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {t("pclab.reviewQueue.title", { defaultValue: "Review Queue" })}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("pclab.reviewQueue.subtitle", {
                    defaultValue: "Pending PC Lab reservations awaiting approval.",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={queueLoading || queueTableLoading}
                  onClick={() => void refreshQueue(showAllQueue ? queuePageIndex : undefined)}
                >
                  {queueLoading
                    ? t("pclab.reviewQueue.loading", { defaultValue: "Loading..." })
                    : t("refresh", { defaultValue: "Refresh" })}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAllQueue(true);
                    resetQueuePaging();
                    void refreshQueue(1);
                  }}
                  disabled={queueLoading || queueTableLoading}
                >
                  {queueLoading
                    ? t("loading", { defaultValue: "Loading..." })
                    : t("deviceLoan.seeAllRequests", { defaultValue: "See All Requests" })}
                </Button>
              </div>
            </div>
            {queueLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("pclab.reviewQueue.loading", { defaultValue: "Loading..." })}
              </div>
            ) : queueError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{queueError}</div>
            ) : (
              <QueueTable
                items={queuePreview}
                emptyLabel={t("pclab.reviewQueue.empty", { defaultValue: "No pending reservations right now." })}
                onViewDetails={(reservation) => navigate(`/dashboard/pc-lab-reservations/${reservation.id}`)}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PCLabReservationPage() {
  return (
    <RequireGroups
      anyOf={["teacher", "admin", "itadmins", "superadmin"]}
      redirectTo="/"
      loadingFallback={<Loader variant="page" />}
      fallback={<div className="p-6 text-muted-foreground">You are not authorized to view this page.</div>}
    >
      <PCLabReservationInner />
    </RequireGroups>
  );
}

function HistoryTable({
  items,
  emptyLabel,
  onViewDetails,
  onCancel,
  cancellingId,
  canModifyReservation,
}: {
  items: Reservation[];
  emptyLabel: string;
  onViewDetails: (reservation: Reservation) => void;
  onCancel: (reservation: Reservation) => void;
  cancellingId: string | null;
  canModifyReservation: (reservation: Reservation) => boolean;
}) {
  const { t } = useTranslation();
  const columnCount = 6;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-3">{t("pclab.form.date", { defaultValue: "Date" })}</th>
            <th className="py-2 pr-3">{t("pclab.form.timeRange", { defaultValue: "Time" })}</th>
            <th className="hidden py-2 pr-3 md:table-cell">{t("pclab.form.pcsNeeded", { defaultValue: "PCs" })}</th>
            <th className="hidden py-2 pr-3 md:table-cell">{t("pclab.form.monitor", { defaultValue: "Monitor" })}</th>
            <th className="py-2 pr-3">{t("status", { defaultValue: "Status" })}</th>
            <th className="py-2 pr-3">{t("deviceLoan.table.actions", { defaultValue: "Actions" })}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="py-6 text-center text-muted-foreground">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            items.map((reservation) => {
              const canModify = canModifyReservation(reservation);
              const isCancelling = cancellingId === reservation.id;
              return (
                <tr key={reservation.id} className="border-b hover:bg-accent/20">
                  <td className="py-2 pr-3 align-top whitespace-nowrap">{reservation.reservationDate}</td>
                  <td className="py-2 pr-3 align-top whitespace-nowrap">
                    <div>
                      {reservation.startTime} - {reservation.endTime}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground md:hidden">
                      {t("pclab.history.summary", {
                        defaultValue: "{{pcs}} PCs · Monitor: {{monitor}}",
                        pcs: reservation.pcsNeeded,
                        monitor: reservation.needsMonitor ? "Yes" : "No",
                      })}
                    </div>
                  </td>
                  <td className="hidden py-2 pr-3 align-top md:table-cell">{reservation.pcsNeeded}</td>
                  <td className="hidden py-2 pr-3 align-top md:table-cell">
                    {reservation.needsMonitor
                      ? t("pclab.form.yes", { defaultValue: "Yes" })
                      : t("pclab.form.no", { defaultValue: "No" })}
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <div className="space-y-1">
                      <StatusBadge status={reservation.status as Status} />
                    </div>
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={() => onViewDetails(reservation)}
                      >
                        {t("deviceLoan.viewDetails", { defaultValue: "View details" })}
                      </Button>
                      {canModify ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          disabled={isCancelling}
                          onClick={() => onCancel(reservation)}
                        >
                          {isCancelling ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t("pclab.history.cancelling", { defaultValue: "Cancelling..." })}
                            </>
                          ) : (
                            t("pclab.history.cancel", { defaultValue: "Cancel request" })
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status?: Status | null }) {
  const normalized = (status || "PENDING").toUpperCase() as Status;
  const colors: Record<Status, string> = {
    PENDING: "bg-amber-100 text-amber-800 border-amber-200",
    APPROVED: "bg-green-100 text-green-800 border-green-200",
    REJECTED: "bg-red-100 text-red-800 border-red-200",
    CANCELLED: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
        colors[normalized] || colors.PENDING
      )}
    >
      {normalized}
    </span>
  );
}

function QueueTable({
  items,
  emptyLabel,
  onViewDetails,
}: {
  items: Reservation[];
  emptyLabel: string;
  onViewDetails?: (reservation: Reservation) => void;
}) {
  const { t } = useTranslation();
  const columnCount = onViewDetails ? 8 : 7;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-3">{t("fullName", { defaultValue: "Full Name" })}</th>
            <th className="hidden py-2 pr-3 md:table-cell">{t("email", { defaultValue: "Email" })}</th>
            <th className="py-2 pr-3">{t("pclab.form.date", { defaultValue: "Date" })}</th>
            <th className="py-2 pr-3">{t("pclab.form.timeRange", { defaultValue: "Time" })}</th>
            <th className="hidden py-2 pr-3 sm:table-cell">{t("pclab.form.pcsNeeded", { defaultValue: "PCs" })}</th>
            <th className="hidden py-2 pr-3 sm:table-cell">{t("pclab.form.monitor", { defaultValue: "Monitor" })}</th>
            <th className="py-2 pr-3">{t("status", { defaultValue: "Status" })}</th>
            {onViewDetails ? (
              <th className="py-2 pr-3">
                {t("deviceLoan.table.actions", { defaultValue: "Actions" })}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="py-6 text-center text-muted-foreground">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            items.map((reservation) => (
              <tr key={reservation.id} className="border-b hover:bg-accent/20">
                <td className="py-2 pr-3 align-top">
                  <div className="text-sm font-medium text-foreground">{reservation.fullName}</div>
                  <div className="text-xs text-muted-foreground break-all md:hidden">{reservation.email}</div>
                </td>
                <td className="hidden py-2 pr-3 align-top md:table-cell break-all">{reservation.email}</td>
                <td className="py-2 pr-3 whitespace-nowrap align-top">{reservation.reservationDate}</td>
                <td className="py-2 pr-3 whitespace-nowrap align-top">
                  {reservation.startTime} - {reservation.endTime}
                </td>
                <td className="hidden py-2 pr-3 align-top sm:table-cell">{reservation.pcsNeeded}</td>
                <td className="hidden py-2 pr-3 align-top sm:table-cell">
                  {reservation.needsMonitor
                    ? t("pclab.form.yes", { defaultValue: "Yes" })
                    : t("pclab.form.no", { defaultValue: "No" })}
                </td>
                <td className="py-2 pr-3 align-top">
                  <StatusBadge status={reservation.status as Status} />
                </td>
                {onViewDetails ? (
                  <td className="py-2 pr-3 align-top">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onClick={() => onViewDetails?.(reservation)}
                    >
                      {t("deviceLoan.viewDetails", { defaultValue: "View details" })}
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
