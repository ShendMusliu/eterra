import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, isAfter } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";
import { getCurrentUser, fetchUserAttributes, fetchAuthSession } from "aws-amplify/auth";
import { useUserGroups, RequireGroups } from "@/hooks/useUserGroups";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const statusValues = ["PENDING", "APPROVED", "REJECTED"] as const;
type Status = (typeof statusValues)[number];

type LoanSortKey = "createdAt" | "borrowDate" | "returnDate";
type LoanSortDir = "desc" | "asc";

const schema = z
  .object({
    reason: z.string().min(5, "Required"),
    borrowDate: z.date({ required_error: "Required" }),
    returnDate: z.date({ required_error: "Required" }),
  })
  .refine((v) => !isAfter(v.borrowDate, v.returnDate), {
    message: "Return date must be after borrow date",
    path: ["returnDate"],
  });

type FormData = z.infer<typeof schema>;

const client = generateClient<Schema>();

type Loan = Schema["DeviceLoanRequest"]["type"];

function DeviceLoanInner() {
  const { t } = useTranslation();
  const { hasAnyGroup } = useUserGroups();
  const navigate = useNavigate();

  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [grade, setGrade] = useState<string | undefined>(undefined);

  const [mine, setMine] = useState<Loan[]>([]);
  const [queueAll, setQueueAll] = useState<Loan[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [queueTable, setQueueTable] = useState<Loan[]>([]);
  const [queueTableLoading, setQueueTableLoading] = useState(false);
  const [queueTableLoaded, setQueueTableLoaded] = useState(false);
  const [showAllQueue, setShowAllQueue] = useState(false);
  const [showMine, setShowMine] = useState(false); // controls modal visibility
  const [mineLoaded, setMineLoaded] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const PAGE_SIZE = 8;
  const [mineStatusFilter, setMineStatusFilter] = useState<"ALL" | Status>("ALL");
  const [mineSortKey, setMineSortKey] = useState<LoanSortKey>("createdAt");
  const [mineSortDir, setMineSortDir] = useState<LoanSortDir>("desc");
  const [mineNextToken, setMineNextToken] = useState<string | undefined>(undefined);
  const [minePrevTokens, setMinePrevTokens] = useState<(string | undefined)[]>([]);
  const [mineCurrentToken, setMineCurrentToken] = useState<string | undefined>(undefined);
  const [minePageIndex, setMinePageIndex] = useState(1);
  const [mineCache, setMineCache] = useState<Record<string, { items: Loan[]; nextToken?: string }>>({});
  const [queueStatusFilter, setQueueStatusFilter] = useState<"ALL" | Status>("ALL");
  const [queueSortKey, setQueueSortKey] = useState<LoanSortKey>("createdAt");
  const [queueSortDir, setQueueSortDir] = useState<LoanSortDir>("desc");
  const [queuePageIndex, setQueuePageIndex] = useState(1);
  const [queueTotalPages, setQueueTotalPages] = useState(1);
  const [queueTotalItems, setQueueTotalItems] = useState(0);
  const [openBorrow, setOpenBorrow] = useState(false);
  const [openReturn, setOpenReturn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isReviewer = useMemo(() => hasAnyGroup(["IT", "ITAdmins", "Admin"]), [hasAnyGroup]);
  const queuePending = useMemo(() => queueAll.filter((item) => (item.status ?? "PENDING").toUpperCase() === "PENDING"), [queueAll]);
  const queuePreview = useMemo(() => queuePending.slice(0, 6), [queuePending]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      reason: "",
      borrowDate: undefined as any,
      returnDate: undefined as any,
    },
  });

  useEffect(() => {
    // Load user basics and lists
    (async () => {
      try {
        setLoading(true);
        const current = await getCurrentUser();
        const attrs = await fetchUserAttributes().catch(() => ({} as any));
        const session = await fetchAuthSession().catch(() => undefined);
        const id =
          (session?.tokens?.idToken?.payload?.sub as string) ||
          (current as any)?.username ||
          (current as any)?.userId ||
          "";
        setUserId(id);
        setUserEmail((attrs as any)?.email || "");
        // Prefer full name. Try `name`, else join given/family, else preferred_username, else username
        {
          const a: any = attrs as any;
          const gn: string | undefined = a?.given_name;
          const fn: string | undefined = a?.family_name;
          const joined = [gn, fn].filter(Boolean).join(" ").trim();
          const preferred: string | undefined = a?.preferred_username;
          const emailFallback: string | undefined = a?.email;
          const fallbackUser: string | undefined = (current as any)?.username;
          setUserName(a?.name || (joined ? joined : preferred) || emailFallback || fallbackUser || "");
        }
        const detectedGrade = (attrs as any)?.["custom:grade"] || (attrs as any)?.grade;
        if (detectedGrade) setGrade(String(detectedGrade));
        // Lazy-load lists: do not load "mine" until user asks; load queue for reviewers
        if (isReviewer) await loadQueue();
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReviewer]);

  function sortClient(
    items: Loan[],
    sortKey: LoanSortKey = mineSortKey,
    sortDir: LoanSortDir = mineSortDir
  ): Loan[] {
    return [...items].sort((a, b) => {
      const av = normalizeSortValue(a, sortKey);
      const bv = normalizeSortValue(b, sortKey);

      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;

      let comparison: number;
      if (typeof av === "number" && typeof bv === "number") {
        comparison = av - bv;
      } else {
        comparison = String(av).localeCompare(String(bv));
      }

      if (comparison === 0) {
        return 0;
      }

      return sortDir === "desc" ? -comparison : comparison;
    });
  }

  function normalizeSortValue(record: Loan, key: LoanSortKey): number | string | null {
    const raw = (record as any)?.[key];
    if (!raw) return null;

    if (key === "createdAt") {
      const ts = Date.parse(String(raw));
      return Number.isNaN(ts) ? String(raw) : ts;
    }

    if (key === "borrowDate" || key === "returnDate") {
      const iso = `${String(raw)}T00:00:00Z`;
      const ts = Date.parse(iso);
      return Number.isNaN(ts) ? String(raw) : ts;
    }

    return String(raw);
  }
  async function loadMine(
    token?: string,
    statusOverride?: "ALL" | Status,
    useCache = true,
    sortOverride?: { sortKey: LoanSortKey; sortDir: LoanSortDir }
  ) {
    if (!userId) {
      setMine([]);
      setMineLoaded(false);
      return;
    }
    setLoadingMine(true);
    try {
      const status = statusOverride ?? mineStatusFilter;
      const sortKey = sortOverride?.sortKey ?? mineSortKey;
      const sortDir = sortOverride?.sortDir ?? mineSortDir;
      const cacheKey = `${userId}::${status}::${token ?? "__root__"}::${sortKey}:${sortDir}`;
      if (useCache && mineCache[cacheKey]) {
        const page = mineCache[cacheKey];
        setMine(sortClient(page.items, sortKey, sortDir));
        setMineNextToken(page.nextToken);
        setMineLoaded(true);
        return;
      }
      const filter: any = { requesterId: { eq: userId } };
      if (status !== "ALL") {
        filter.status = { eq: status };
      }

      const aggregated: Loan[] = [];
      let remaining = PAGE_SIZE;
      let nextTokenLocal: string | undefined = token;
      let safetyCounter = 0;

      while (remaining > 0) {
        const res: any = await client.models.DeviceLoanRequest.list({
          authMode: "userPool",
          limit: Math.max(remaining, 1),
          nextToken: nextTokenLocal,
          filter,
        } as any);

        const fetched: Loan[] = (res.data ?? []).filter(Boolean) as Loan[];
        aggregated.push(...fetched);
        remaining = PAGE_SIZE - aggregated.length;
        nextTokenLocal = (res as any)?.nextToken ?? undefined;

        // Prevent potential infinite loops if the API keeps returning empty pages with a next token
        safetyCounter += 1;
        if (!nextTokenLocal || fetched.length === 0 || safetyCounter > 5) {
          break;
        }
      }

      const pageItems = aggregated.slice(0, PAGE_SIZE);
      setMine(sortClient(pageItems, sortKey, sortDir));
      setMineNextToken(nextTokenLocal);
      setMineLoaded(true);
      setMineCache((prev) => ({
        ...prev,
        [cacheKey]: { items: pageItems, nextToken: nextTokenLocal },
      }));
    } finally {
      setLoadingMine(false);
    }
  }

  function resetMinePaging() {
    setMinePrevTokens([]);
    setMineCurrentToken(undefined);
    setMineNextToken(undefined);
    setMinePageIndex(1);
    setMineCache({});
  }

  function resetQueuePaging() {
    setQueuePageIndex(1);
    setQueueTotalPages(1);
    setQueueTotalItems(0);
    setQueueTable([]);
    setQueueTableLoaded(false);
  }

  async function loadQueue() {
    setQueueLoading(true);
    try {
      const collected: Loan[] = [];
      let nextToken: string | undefined;
      do {
        const res: any = await client.models.DeviceLoanRequest.list({
          authMode: "userPool",
          limit: 100,
          nextToken,
        });
        const items = ((res.data ?? []) as (Loan | null | undefined)[]).filter((x): x is Loan => Boolean(x));
        collected.push(...items);
        nextToken = (res as any)?.nextToken ?? undefined;
      } while (nextToken);
      const sorted = sortClient(collected, "createdAt", "desc");
      setQueueAll(sorted);
      setQueueLoaded(true);
      return sorted;
    } catch (error) {
      setQueueAll([]);
      setQueueLoaded(false);
      throw error;
    } finally {
      setQueueLoading(false);
    }
  }

  async function loadQueuePage(
    options?: {
      pageIndex?: number;
      statusOverride?: "ALL" | Status;
      sortOverride?: { sortKey: LoanSortKey; sortDir: LoanSortDir };
      sourceOverride?: Loan[];
    }
  ) {
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
        status === "ALL"
          ? source
          : source.filter((item) => (item.status ?? "PENDING").toUpperCase() === status);

      const sorted = sortClient(filtered, sortKey, sortDir);
      const totalItems = sorted.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
      const requestedIndex = options?.pageIndex ?? queuePageIndex ?? 1;
      const clampedPageIndex = Math.min(Math.max(requestedIndex, 1), totalPages);
      const start = (clampedPageIndex - 1) * PAGE_SIZE;
      const pageItems = sorted.slice(start, start + PAGE_SIZE);

      setQueueTable(pageItems);
      setQueueTableLoaded(true);
      setQueuePageIndex(clampedPageIndex);
      setQueueTotalPages(totalPages);
      setQueueTotalItems(totalItems);
    } finally {
      setQueueTableLoading(false);
    }
  }

  async function refreshQueue(pageIndex?: number) {
    const updateTable = pageIndex !== undefined;
    if (updateTable) {
      setQueueTableLoaded(false);
      setQueueTableLoading(true);
    }
    try {
      const data = await loadQueue();
      if (updateTable && pageIndex !== undefined) {
        await loadQueuePage({ pageIndex, sourceOverride: data });
      }
    } catch (err) {
      if (updateTable) {
        setQueueTableLoaded(true);
        setQueueTableLoading(false);
      }
      console.error("Failed to refresh queue", err);
    }
  }

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const createdRes: any = await (client as any).mutations.createDeviceLoanAndNotify(
        {
          reason: data.reason,
          borrowDate: format(data.borrowDate, "yyyy-MM-dd"),
          returnDate: format(data.returnDate, "yyyy-MM-dd"),
          grade,
          email: userEmail,
          fullName: userName,
        },
        { authMode: "userPool" }
      );
      reset();

      const newLoan: Loan | null = createdRes?.data ?? createdRes ?? null;
      if (newLoan?.id) {
        setMine((prev) => sortClient([newLoan, ...prev]));
        setMineCache({});
        setMineLoaded(true);
      }

      if (showMine && mineLoaded) {
        await loadMine(mineCurrentToken, undefined, false);
      }
      if (isReviewer) {
        void refreshQueue(showAllQueue ? queuePageIndex : undefined);
      }
    } catch (e: any) {
      setError(e?.message || t("unexpectedError", { defaultValue: "Something went wrong" }));
    }
  }



  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-6 pt-20 pb-12">
      <h1 className="text-2xl font-bold mb-2">{t("deviceLoan.title", { defaultValue: "Device Loan" })}</h1>
      <p className="text-muted-foreground mb-6">
        {t("deviceLoan.subtitle", { defaultValue: "Request a device for temporary use." })}
      </p>

      {error && (
        <div role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {/* Create form */}
      <Card className="mb-8">
        <CardContent className="p-5">
          <h2 className="text-lg font-semibold mb-4">{t("deviceLoan.newRequest", { defaultValue: "New Request" })}</h2>

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {/* Email (read-only) */}
            <div>
              <Label htmlFor="email">{t("email", { defaultValue: "Email" })}</Label>
              <Input id="email" value={userEmail} readOnly className="bg-muted" />
            </div>
            {/* Name (read-only) */}
            <div>
              <Label htmlFor="fullName">{t("fullName", { defaultValue: "Full Name" })}</Label>
              <Input id="fullName" value={userName} readOnly className="bg-muted" />
            </div>
            {/* Grade (read-only, optional) */}
            {grade && (
              <div>
                <Label htmlFor="grade">{t("grade", { defaultValue: "Grade" })}</Label>
                <Input id="grade" value={grade} readOnly className="bg-muted" />
              </div>
            )}

            {/* Reason */}
            <div>
              <Label htmlFor="reason">{t("reason", { defaultValue: "Reason" })}</Label>
              <Controller
                name="reason"
                control={control}
                render={({ field }) => <Textarea id="reason" {...field} rows={3} />}
              />
              {errors.reason && <span className="text-xs text-red-600">{String(errors.reason.message)}</span>}
            </div>

            {/* Borrow Date */}
            <div>
              <Label htmlFor="borrowDate">{t("borrowDate", { defaultValue: "Borrow date" })}</Label>
              <Controller
                name="borrowDate"
                control={control}
                render={({ field }) => (
                  <Popover open={openBorrow} onOpenChange={setOpenBorrow}>
                    <PopoverTrigger asChild>
                      <Button id="borrowDate" type="button" variant="outline" className="w-full justify-between font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : t("selectDate", { defaultValue: "Select date" })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(d) => {
                          const next = d ?? field.value;
                          field.onChange(next);
                          setOpenBorrow(false);
                        }}
                        disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.borrowDate && <span className="text-xs text-red-600">{String(errors.borrowDate.message)}</span>}
            </div>

            {/* Return Date */}
            <div>
              <Label htmlFor="returnDate">{t("returnDate", { defaultValue: "Return date" })}</Label>
              <Controller
                name="returnDate"
                control={control}
                render={({ field }) => (
                  <Popover open={openReturn} onOpenChange={setOpenReturn}>
                    <PopoverTrigger asChild>
                      <Button id="returnDate" type="button" variant="outline" className="w-full justify-between font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : t("selectDate", { defaultValue: "Select date" })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(d) => {
                          const next = d ?? field.value;
                          field.onChange(next);
                          setOpenReturn(false);
                        }}
                        disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.returnDate && <span className="text-xs text-red-600">{String(errors.returnDate.message)}</span>}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={async () => {
                  if (!mineLoaded) await loadMine();
                  setShowMine(true);
                }}
              >
                {t("deviceLoan.seeMyPrevious", { defaultValue: "See My Previous Requests" })}
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => reset()}>
                {t("reset", { defaultValue: "Reset" })}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting
                  ? t("saving", { defaultValue: "Saving…" })
                  : t("submit", { defaultValue: "Submit" })}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* My requests modal */}
      <Dialog open={showMine} onOpenChange={(v) => {
        setShowMine(v);
        if (v && !mineLoaded) {
          resetMinePaging();
          loadMine();
        }
      }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("deviceLoan.myRequests", { defaultValue: "My Requests" })}</DialogTitle>
            <DialogDescription>
              {t("deviceLoan.myRequestsHint", { defaultValue: "Your previously submitted device loan requests." })}
            </DialogDescription>
          </DialogHeader>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                <Label htmlFor="statusFilter" className="text-xs font-semibold uppercase text-muted-foreground">Status</Label>
                <select
                  id="statusFilter"
                  className="w-full rounded border px-2 py-1 text-sm bg-background sm:w-40"
                  value={mineStatusFilter}
                  onChange={async (e) => {
                    const val = e.target.value as any;
                    setMineStatusFilter(val);
                    resetMinePaging();
                    await loadMine(undefined, val, false);
                  }}
                >
                  <option value="ALL">All</option>
                  {statusValues.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                <Label htmlFor="sortBy" className="text-xs font-semibold uppercase text-muted-foreground">Sort</Label>
                <select
                  id="sortBy"
                  className="w-full rounded border px-2 py-1 text-sm bg-background sm:w-48"
                  value={`${mineSortKey}:${mineSortDir}`}
                  onChange={async (e) => {
                    const [nextSortKey, nextSortDir] = e.target.value.split(":") as [LoanSortKey, LoanSortDir];
                    setMineSortKey(nextSortKey);
                    setMineSortDir(nextSortDir);
                    resetMinePaging();
                    await loadMine(undefined, undefined, false, { sortKey: nextSortKey, sortDir: nextSortDir });
                  }}
                >
                  <option value="createdAt:desc">Newest</option>
                  <option value="createdAt:asc">Oldest</option>
                  <option value="borrowDate:asc">Borrow date (earliest first)</option>
                  <option value="borrowDate:desc">Borrow date (latest first)</option>
                  <option value="returnDate:asc">Return date (earliest first)</option>
                  <option value="returnDate:desc">Return date (latest first)</option>
                </select>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              {(minePrevTokens.length > 0 || !!mineNextToken || mine.length > 0) && (
                <span className="text-xs text-muted-foreground">Page {minePageIndex}</span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={minePrevTokens.length === 0 || loadingMine}
                onClick={async () => {
                  const prevToken = minePrevTokens[minePrevTokens.length - 1];
                  const newStack = [...minePrevTokens];
                  newStack.pop();
                  setMinePrevTokens(newStack);
                  setMineCurrentToken(prevToken);
                  setMinePageIndex((p) => Math.max(1, p - 1));
                  await loadMine(prevToken);
                }}
              >
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={!mineNextToken || loadingMine}
                onClick={async () => {
                  setMinePrevTokens((s) => [...s, mineCurrentToken]);
                  setMineCurrentToken(mineNextToken);
                  setMinePageIndex((p) => p + 1);
                  await loadMine(mineNextToken);
                }}
              >
                Next
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => loadMine(mineCurrentToken, undefined, false)}
                disabled={loadingMine}
              >
                {loadingMine ? t("loading", { defaultValue: "Loading..." }) : t("refresh", { defaultValue: "Refresh" })}
              </Button>
            </div>
          </div>
          <div className="min-h-[50vh] max-h-[60vh] overflow-auto">
            <ListTable
              items={mine}
              onViewDetails={(item) => {
                if (!item?.id) return;
                setShowMine(false);
                navigate(`/dashboard/device-loan/${item.id}`);
              }}
              showIdentityColumns={false}
            />
          </div>
        </DialogContent>
      </Dialog>

      {isReviewer && (
        <>
          <Dialog
            open={showAllQueue}
            onOpenChange={(nextOpen) => {
              setShowAllQueue(nextOpen);
              if (nextOpen) {
                resetQueuePaging();
                void refreshQueue(1);
              }
            }}
          >
            <DialogContent className="sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>{t("deviceLoan.allRequests", { defaultValue: "All Device Loan Requests" })}</DialogTitle>
                <DialogDescription>
                  {t("deviceLoan.allRequestsHint", { defaultValue: "Browse every submitted request, including resolved items." })}
                </DialogDescription>
              </DialogHeader>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                    <Label htmlFor="queueStatusFilter" className="text-xs font-semibold uppercase text-muted-foreground">Status</Label>
                    <select
                      id="queueStatusFilter"
                      className="w-full rounded border px-2 py-1 text-sm bg-background sm:w-40"
                      value={queueStatusFilter}
                      onChange={async (e) => {
                        const val = e.target.value as typeof queueStatusFilter;
                        setQueueStatusFilter(val);
                        resetQueuePaging();
                        await loadQueuePage({ pageIndex: 1, statusOverride: val });
                      }}
                    >
                      <option value="ALL">All</option>
                      {statusValues.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                    <Label htmlFor="queueSortBy" className="text-xs font-semibold uppercase text-muted-foreground">Sort</Label>
                    <select
                      id="queueSortBy"
                      className="w-full rounded border px-2 py-1 text-sm bg-background sm:w-48"
                      value={`${queueSortKey}:${queueSortDir}`}
                      onChange={async (e) => {
                        const [nextSortKey, nextSortDir] = e.target.value.split(":") as [LoanSortKey, LoanSortDir];
                        setQueueSortKey(nextSortKey);
                        setQueueSortDir(nextSortDir);
                        resetQueuePaging();
                        await loadQueuePage({ pageIndex: 1, sortOverride: { sortKey: nextSortKey, sortDir: nextSortDir } });
                      }}
                    >
                      <option value="createdAt:desc">Newest</option>
                      <option value="createdAt:asc">Oldest</option>
                      <option value="borrowDate:asc">Borrow date (earliest first)</option>
                      <option value="borrowDate:desc">Borrow date (latest first)</option>
                      <option value="returnDate:asc">Return date (earliest first)</option>
                      <option value="returnDate:desc">Return date (latest first)</option>
                    </select>
                  </div>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  {queueTableLoaded && queueTotalItems > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Page {queuePageIndex} of {queueTotalPages}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    disabled={queueTableLoading || queueTotalItems === 0 || queuePageIndex <= 1}
                    onClick={async () => {
                      if (queuePageIndex <= 1) return;
                      await loadQueuePage({ pageIndex: queuePageIndex - 1 });
                    }}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    disabled={
                      queueTableLoading ||
                      queueTotalItems === 0 ||
                      queuePageIndex >= queueTotalPages
                    }
                    onClick={async () => {
                      if (queuePageIndex >= queueTotalPages) return;
                      await loadQueuePage({ pageIndex: queuePageIndex + 1 });
                    }}
                  >
                    Next
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={async () => {
                      await refreshQueue(queuePageIndex);
                    }}
                    disabled={queueTableLoading}
                  >
                    {queueTableLoading
                      ? t("loading", { defaultValue: "Loading..." })
                      : t("refresh", { defaultValue: "Refresh" })}
                  </Button>
                </div>
              </div>
              <div className="min-h-[50vh] max-h-[60vh] overflow-auto">
                {queueTableLoading && !queueTableLoaded ? (
                  <div className="flex h-full items-center justify-center py-10 text-sm text-muted-foreground">
                    {t("loading", { defaultValue: "Loading..." })}
                  </div>
                ) : (
                  <ListTable
                    items={queueTable}
                    onViewDetails={(item) => {
                      setShowAllQueue(false);
                      navigate(`/dashboard/device-loan/${item.id}`);
                    }}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {t("deviceLoan.reviewQueue", { defaultValue: "Review Queue" })}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("deviceLoan.reviewQueueHint", { defaultValue: "Latest pending requests that still need a decision." })}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={queueLoading || queueTableLoading}
                    onClick={() => void refreshQueue(1)}
                  >
                    {queueLoading || queueTableLoading
                      ? t("loading", { defaultValue: "Loading..." })
                      : t("refresh", { defaultValue: "Refresh" })}
                  </Button>
                  <Button
                    type="button"
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
              <ListTable
                items={queuePreview}
                onViewDetails={(item) => navigate(`/dashboard/device-loan/${item.id}`)}
                emptyLabel={t("deviceLoan.noPendingRequests", { defaultValue: "No pending requests" })}
              />
              {queuePending.length > queuePreview.length && (
                <p className="text-xs text-muted-foreground">
                  {t("deviceLoan.pendingPreviewHint", {
                    defaultValue: "Showing the latest {{count}} pending requests. Open the full list to see everything.",
                    count: queuePreview.length,
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function DeviceLoan() {
  // Only allow Students, Teachers, and Admins (admin always included)
  return (
    <RequireGroups
      anyOf={["student", "teacher", "admin"]}
      redirectTo="/"
      loadingFallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}
      fallback={<div className="p-6 text-sm text-muted-foreground">You are not authorized to view this page.</div>}
    >
      <DeviceLoanInner />
    </RequireGroups>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const s = (status || "PENDING").toUpperCase();
  const color =
    s === "APPROVED"
      ? "bg-green-100 text-green-800 border-green-200"
      : s === "REJECTED"
      ? "bg-red-100 text-red-800 border-red-200"
      : "bg-amber-100 text-amber-800 border-amber-200";
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${color}`}>{s}</span>;
}

function ListTable({
  items,
  onViewDetails,
  emptyLabel = "No records",
  showIdentityColumns = true,
}: {
  items: Loan[];
  onViewDetails?: (item: Loan) => void;
  emptyLabel?: string;
  showIdentityColumns?: boolean;
}) {
  const { t } = useTranslation();
  const canViewDetails = typeof onViewDetails === "function";
  const columnCount = showIdentityColumns ? 7 : 5;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            {showIdentityColumns && (
              <>
                <th className="hidden py-2 pr-3 sm:table-cell">{t("deviceLoan.table.name", { defaultValue: "Name" })}</th>
                <th className="hidden py-2 pr-3 sm:table-cell">{t("deviceLoan.table.email", { defaultValue: "Email" })}</th>
              </>
            )}
            <th className="py-2 pr-3">{t("deviceLoan.table.borrow", { defaultValue: "Borrow" })}</th>
            <th className="py-2 pr-3">{t("deviceLoan.table.return", { defaultValue: "Return" })}</th>
            <th className="py-2 pr-3">{t("deviceLoan.table.reason", { defaultValue: "Reason" })}</th>
            <th className="py-2 pr-3">{t("deviceLoan.table.status", { defaultValue: "Status" })}</th>
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
            items.map((it) => (
              <tr key={it.id} className="border-b hover:bg-accent/20">
                {showIdentityColumns && (
                  <>
                    <td className="hidden py-2 pr-3 sm:table-cell">{it.fullName}</td>
                    <td className="hidden py-2 pr-3 sm:table-cell">{it.email}</td>
                  </>
                )}
                <td className="py-2 pr-3 whitespace-nowrap">{it.borrowDate}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{it.returnDate}</td>
                <td
                  className="py-2 pr-3 break-words text-sm leading-snug sm:max-w-[28ch] sm:truncate"
                  title={it.reason || ""}
                >
                  {showIdentityColumns && (it.fullName || it.email) ? (
                    <div className="mb-2 space-y-0.5 text-xs sm:hidden">
                      {it.fullName ? <div className="font-medium text-foreground">{it.fullName}</div> : null}
                      {it.email ? <div className="text-[11px] text-muted-foreground break-all">{it.email}</div> : null}
                    </div>
                  ) : null}
                  <div>{it.reason}</div>
                </td>
                <td className="py-2 pr-3">
                  <StatusBadge status={it.status} />
                </td>
                <td className="py-2 pr-3">
                  {canViewDetails ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onClick={() => onViewDetails?.(it)}
                    >
                      {t("deviceLoan.viewDetails", { defaultValue: "View details" })}
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}








