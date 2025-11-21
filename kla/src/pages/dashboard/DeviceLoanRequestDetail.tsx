import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { generateClient } from "aws-amplify/data";
import { useAuthUser } from "@/hooks/useAuthUser";
import type { Schema } from "../../../amplify/data/resource";
import { useUserGroups } from "@/hooks/useUserGroups";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const client = generateClient<Schema>();

const statusValues = ["PENDING", "APPROVED", "REJECTED"] as const;
const reviewerGroupNames = ["admin", "it", "itadmins"] as const;
type Status = (typeof statusValues)[number];
type Loan = Schema["DeviceLoanRequest"]["type"];
type LoanEvent = Schema["DeviceLoanEvent"]["type"];

function StatusBadge({ status }: { status?: string | null }) {
  const value = (status || "PENDING").toUpperCase();
  const color =
    value === "APPROVED"
      ? "bg-green-100 text-green-800 border-green-200"
      : value === "REJECTED"
      ? "bg-red-100 text-red-800 border-red-200"
      : "bg-amber-100 text-amber-800 border-amber-200";
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${color}`}>{value}</span>;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  const display = value === undefined || value === null || value === "" ? "N/A" : value;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm text-foreground">{display}</div>
    </div>
  );
}

function formatDateTime(value?: string | null): string {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
}

function DeviceLoanRequestDetailInner() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [events, setEvents] = useState<LoanEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const { user, loading: userLoading } = useAuthUser();
  const { loading: groupsLoading, hasAnyGroup } = useUserGroups();

  const canManage = useMemo(() => hasAnyGroup(reviewerGroupNames), [hasAnyGroup]);
  const isOwner = useMemo(() => {
    if (!user?.userId || !loan?.requesterId) return false;
    return String(user.userId) === String(loan.requesterId);
  }, [loan?.requesterId, user?.userId]);
  const canView = canManage || isOwner;
  const combinedLoading = loading || userLoading || groupsLoading;


  const fetchEvents = useCallback(
    async (targetId: string) => {
      setEventsLoading(true);
      setEventsError(null);
      try {
        const aggregated: LoanEvent[] = [];
        let nextToken: string | undefined;
        let guard = 0;
        do {
          const res: any = await client.models.DeviceLoanEvent.list({
            authMode: "userPool",
            filter: { requestId: { eq: targetId } },
            limit: 50,
            nextToken,
          } as any);
          const items = (res?.data as LoanEvent[] | undefined) ?? [];
          aggregated.push(...items.filter(Boolean));
          nextToken = res?.nextToken as string | undefined;
          guard += 1;
        } while (nextToken && guard < 10);
        aggregated.sort((a, b) => {
          const aSource = a?.changedAt || a?.createdAt;
          const bSource = b?.changedAt || b?.createdAt;
          const aTime = aSource ? new Date(aSource).getTime() : 0;
          const bTime = bSource ? new Date(bSource).getTime() : 0;
          return bTime - aTime;
        });
        setEvents(aggregated);
      } catch (err: any) {
        const fallback = t("deviceLoan.auditLoadFailed", { defaultValue: "Failed to load history." });
        setEventsError(err?.message || fallback);
        setEvents([]);
      } finally {
        setEventsLoading(false);
      }
    },
    [t]
  );

  const load = useCallback(async () => {
    if (!requestId) {
      setLoan(null);
      setEvents([]);
      setEventsError(null);
      setEventsLoading(false);
      setError(t("deviceLoan.missingRequestId", { defaultValue: "Request id is missing." }));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    setEventsError(null);
    try {
      const res: any = await client.models.DeviceLoanRequest.get({ id: requestId }, { authMode: "userPool" });
      const data = (res?.data as Loan | null | undefined) ?? null;
      setLoan(data);
      if (data?.id) {
        void fetchEvents(data.id);
      } else {
        setEvents([]);
      }
      if (!data) {
        setError(t("deviceLoan.requestNotFound", { defaultValue: "Request not found." }));
      }
    } catch (err: any) {
      const fallbackMessage = t("deviceLoan.loadFailed", { defaultValue: "Failed to load request." });
      const rawMessage =
        (typeof err?.message === "string" ? err.message : undefined) ||
        (Array.isArray(err?.errors)
          ? err.errors
              .map((e: any) => (typeof e?.message === "string" ? e.message : undefined))
              .filter(Boolean)
              .join(", ")
          : undefined) ||
        "";
      const lower = rawMessage.toLowerCase?.() ?? "";
      if (lower.includes("not authorized") || lower.includes("unauthorized")) {
        setError(t("deviceLoan.notAuthorizedView", { defaultValue: "You are not allowed to view this request." }));
      } else {
        setError(rawMessage || fallbackMessage);
      }
      setEvents([]);
      setEventsLoading(false);
      setEventsError(t("deviceLoan.auditLoadFailed", { defaultValue: "Failed to load history." }));
      setLoan(null);
    } finally {
      setLoading(false);
    }
  }, [fetchEvents, requestId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusLabels = useMemo(
    () => ({
      PENDING: t("deviceLoan.statusPending", { defaultValue: "Pending" }),
      APPROVED: t("deviceLoan.statusApproved", { defaultValue: "Approved" }),
      REJECTED: t("deviceLoan.statusRejected", { defaultValue: "Rejected" }),
    }),
    [t]
  );

  const status = useMemo<Status>(() => {
    const raw = (loan?.status || "PENDING").toString().toUpperCase();
    return (statusValues.includes(raw as Status) ? raw : "PENDING") as Status;
  }, [loan?.status]);

  const getStatusLabel = useCallback(
    (value?: string | null) => {
      const key = (value || "").toString().toUpperCase() as Status;
      if (statusLabels[key]) {
        return statusLabels[key];
      }
      return value ?? statusLabels.PENDING;
    },
    [statusLabels]
  );

  const handleStatusChange = useCallback(
    async (nextStatus: Status) => {
      if (!canManage) {
        setError(t("deviceLoan.notAuthorizedManage", { defaultValue: "You are not allowed to update this request." }));
        return;
      }
      if (!loan?.id) return;
      setActionLoading(true);
      setError(null);
      setNotice(null);
      try {
        const notesPayload = typeof loan.notes === "string" ? loan.notes : "";
        const input = { id: loan.id, status: nextStatus, notes: notesPayload };
        const setStatus: any = (client as any)?.mutations?.setDeviceLoanStatus;
        if (typeof setStatus !== "function") {
          throw new Error(
            t("deviceLoan.statusMutationUnavailable", {
              defaultValue: "Status update is temporarily unavailable. Please try again later.",
            })
          );
        }
        await setStatus(input, { authMode: "userPool" });
        await load();
        setNotice(
          t("deviceLoan.statusUpdatedTo", {
            defaultValue: "Status updated to {{label}}.",
            label: statusLabels[nextStatus] ?? nextStatus,
          })
        );
      } catch (err: any) {
        setError(err?.message || t("deviceLoan.statusUpdateFailed", { defaultValue: "Failed to update status." }));
      } finally {
        setActionLoading(false);
      }
    },
    [canManage, loan?.id, loan?.notes, load, statusLabels, t]
  );

  const handleDelete = useCallback(async () => {
    if (!canManage) {
      setError(t("deviceLoan.notAuthorizedManage", { defaultValue: "You are not allowed to update this request." }));
      return;
    }
    if (!loan?.id) return;
    const confirmed = window.confirm(
      t("deviceLoan.deleteConfirm", { defaultValue: "Delete this request? This cannot be undone." })
    );
    if (!confirmed) return;
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      await client.models.DeviceLoanRequest.delete({ id: loan.id }, { authMode: "userPool" });
      navigate("/dashboard/device-loan", { replace: true });
    } catch (err: any) {
      setError(err?.message || t("deviceLoan.deleteFailed", { defaultValue: "Failed to delete request." }));
    } finally {
      setActionLoading(false);
    }
  }, [canManage, loan?.id, navigate, t]);

  const availability = t("deviceLoan.notAvailable", { defaultValue: "Not available" });
  const reasonText = loan?.reason && loan.reason.trim().length > 0
    ? loan.reason.trim()
    : t("deviceLoan.noReasonProvided", { defaultValue: "No reason provided." });
  const notesText = loan?.notes && loan.notes.trim().length > 0 ? loan.notes.trim() : "";
  const createdAt = loan ? formatDateTime(loan.createdAt) : "";
  const updatedAt = loan ? formatDateTime(loan.updatedAt) : "";

  return (
    <div className="mx-auto max-w-3xl px-3 sm:px-6 pt-20 pb-12">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="pl-0"
        onClick={() => navigate("/dashboard/device-loan")}
      >
        {t("deviceLoan.backToQueue", { defaultValue: "Back to requests" })}
      </Button>

      {error && (
        <div role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      {combinedLoading ? (
        <Card className="mt-6">
          <CardContent className="py-10 text-sm text-muted-foreground">
            {t("loading", { defaultValue: "Loading..." })}
          </CardContent>
        </Card>
      ) : !loan ? (
        <Card className="mt-6">
          <CardContent className="py-10 text-sm text-muted-foreground">
            {t("deviceLoan.requestNotFound", { defaultValue: "Request not found." })}
          </CardContent>
        </Card>
      ) : !canView ? (
        <Card className="mt-6">
          <CardContent className="py-10 text-sm text-muted-foreground">
            {t("deviceLoan.notAuthorizedView", { defaultValue: "You are not allowed to view this request." })}
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardHeader className="border-b pb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-2xl">{loan.fullName || availability}</CardTitle>
                <CardDescription>
                  {(loan.email || availability) + (loan.grade ? " - " + t("grade", { defaultValue: "Grade" }) + ": " + loan.grade : "")}
                </CardDescription>
              </div>
              <StatusBadge status={loan.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6 py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailRow label={t("deviceLoan.requestId", { defaultValue: "Request ID" })} value={loan.id} />
              <DetailRow label={t("deviceLoan.status", { defaultValue: "Status" })} value={statusLabels[status]} />
              <DetailRow label={t("deviceLoan.borrowDateLabel", { defaultValue: "Borrow Date" })} value={loan.borrowDate || availability} />
              <DetailRow label={t("deviceLoan.returnDateLabel", { defaultValue: "Return Date" })} value={loan.returnDate || availability} />
              <DetailRow label={t("deviceLoan.createdAtLabel", { defaultValue: "Submitted" })} value={createdAt || availability} />
              <DetailRow label={t("deviceLoan.updatedAtLabel", { defaultValue: "Updated" })} value={updatedAt || availability} />
            </div>
            <Separator />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("deviceLoan.reason", { defaultValue: "Reason" })}
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{reasonText}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("deviceLoan.auditHeading", { defaultValue: "Status history" })}
              </div>
              <div className="mt-2 space-y-3">
                {eventsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    {t("deviceLoan.auditLoading", { defaultValue: "Loading history..." })}
                  </p>
                ) : eventsError ? (
                  <p className="text-sm text-red-600">{eventsError}</p>
                ) : events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("deviceLoan.auditEmpty", { defaultValue: "No history recorded yet." })}
                  </p>
                ) : (
                  events.map((event) => {
                    const newLabel = getStatusLabel(event.newStatus);
                    const oldLabel = event.oldStatus ? getStatusLabel(event.oldStatus) : null;
                    const actorRaw = (event.changedByName || "").trim() || (event.changedByEmail || "").trim();
                    const actorLabel =
                      actorRaw || t("deviceLoan.auditUnknownActor", { defaultValue: "Unknown user" });
                    const eventTitle = oldLabel
                      ? t("deviceLoan.auditStatusChange", {
                          from: oldLabel,
                          to: newLabel,
                          defaultValue: `Status updated: ${oldLabel} -> ${newLabel}`,
                        })
                      : t("deviceLoan.auditCreated", {
                          status: newLabel,
                          defaultValue: `Request created (${newLabel})`,
                        });
                    const changedBy = t("deviceLoan.auditChangedBy", {
                      name: actorLabel,
                      defaultValue: `Changed by ${actorLabel}`,
                    });
                    const timestamp = formatDateTime(event.changedAt || event.createdAt);
                    const note = (event.notes || "").trim();
                    const key = event.id || `${event.requestId}-${event.changedAt || event.createdAt || "unknown"}`;
                    return (
                      <div key={key} className="rounded-md border border-border/60 bg-muted/10 p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">{eventTitle}</span>
                          <span className="text-xs text-muted-foreground">{timestamp}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{changedBy}</div>
                        {note ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{note}</p>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            {notesText && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("deviceLoan.reviewerNotes", { defaultValue: "Reviewer Notes" })}
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{notesText}</p>
              </div>
            )}
            <Separator />
            {canManage ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleStatusChange("APPROVED")}
                  disabled={actionLoading || status === "APPROVED"}
                >
                  {t("deviceLoan.approve", { defaultValue: "Approve" })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => handleStatusChange("REJECTED")}
                  disabled={actionLoading || status === "REJECTED"}
                >
                  {t("deviceLoan.reject", { defaultValue: "Reject" })}
                </Button>
                {status !== "PENDING" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleStatusChange("PENDING")}
                    disabled={actionLoading}
                  >
                    {t("deviceLoan.resetToPending", { defaultValue: "Move Back to Pending" })}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={actionLoading}
                >
                  {t("deviceLoan.delete", { defaultValue: "Delete" })}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("deviceLoan.readOnlyNotice", {
                  defaultValue: "If you have questions about this request, please contact the IT team.",
                })}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DeviceLoanRequestDetail() {
  return <DeviceLoanRequestDetailInner />;
}






