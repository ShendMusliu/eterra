import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../../amplify/data/resource";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useUserGroups } from "@/hooks/useUserGroups";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Loader from "@/components/Loader";
import { emitPCLabQueueRefresh } from "@/lib/pclabEvents";
import { useToast } from "@/components/ui/use-toast";

type Reservation = Schema["PCLabReservation"]["type"];
type ReservationEvent = Schema["PCLabReservationEvent"]["type"];
type Status = Schema["PCLabReservationStatus"]["type"];

const statusLabels: Record<Status, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

const reviewerGroups = ["admin", "itadmins", "superadmin"] as const;

const client = generateClient<Schema>();

function StatusBadge({ status }: { status?: Status | null }) {
  const normalized = (status || "PENDING").toUpperCase() as Status;
  const color =
    normalized === "APPROVED"
      ? "bg-green-100 text-green-800 border-green-200"
      : normalized === "REJECTED"
      ? "bg-red-100 text-red-700 border-red-200"
      : normalized === "CANCELLED"
      ? "bg-slate-100 text-slate-700 border-slate-200"
      : "bg-amber-100 text-amber-800 border-amber-200";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${color}`}>
      {statusLabels[normalized] || normalized}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm text-foreground">{value ?? "N/A"}</div>
    </div>
  );
}

function HistoryRow({ event }: { event: ReservationEvent }) {
  const date = event.changedAt ? new Date(event.changedAt).toLocaleString() : "";
  const status = (event.newStatus as Status) || "PENDING";
  return (
    <div className="rounded-lg border border-border p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold">{statusLabels[status] || status}</div>
          <div className="text-xs text-muted-foreground">
            {event.changedByName || event.changedByEmail || event.changedBySub} • {date}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      {event.notes ? <p className="mt-2 text-sm text-muted-foreground">{event.notes}</p> : null}
    </div>
  );
}

export default function PCLabReservationDetail() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: userLoading } = useAuthUser();
  const { loading: groupsLoading, hasAnyGroup } = useUserGroups();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [events, setEvents] = useState<ReservationEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<Status | null>(null);
  const { toast } = useToast();

  const canReview = useMemo(() => hasAnyGroup(reviewerGroups), [hasAnyGroup]);
  const isOwner = useMemo(() => {
    if (!user?.userId || !reservation?.requesterId) return false;
    return String(user.userId) === String(reservation.requesterId);
  }, [user?.userId, reservation?.requesterId]);
  const canView = canReview || isOwner;

  const fetchEvents = useCallback(
    async (targetId: string) => {
      setEventsLoading(true);
      setEventsError(null);
      try {
        const aggregated: ReservationEvent[] = [];
        let nextToken: string | undefined;
        do {
          const res: any = await client.models.PCLabReservationEvent.list({
            authMode: "userPool",
            filter: { reservationId: { eq: targetId } },
            limit: 50,
            nextToken,
          } as any);
          const items = (res?.data as ReservationEvent[] | undefined) ?? [];
          aggregated.push(...items.filter(Boolean));
          nextToken = (res as any)?.nextToken ?? undefined;
        } while (nextToken);
        aggregated.sort((a, b) => {
          const aTime = a?.changedAt ? new Date(a.changedAt).getTime() : 0;
          const bTime = b?.changedAt ? new Date(b.changedAt).getTime() : 0;
          return bTime - aTime;
        });
        setEvents(aggregated);
      } catch (err: any) {
        const message =
          typeof err?.message === "string"
            ? err.message
            : t("pclab.detail.historyLoadFailed", { defaultValue: "Failed to load history." });
        setEventsError(message);
        setEvents([]);
      } finally {
        setEventsLoading(false);
      }
    },
    [t]
  );

  const loadReservation = useCallback(async () => {
    if (!reservationId) {
      setError(t("pclab.detail.missingId", { defaultValue: "Reservation id missing." }));
      setReservation(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res: any = await client.models.PCLabReservation.get({ id: reservationId }, { authMode: "userPool" });
      const data = (res?.data as Reservation | null | undefined) ?? null;
      if (!data) {
        setError(t("pclab.detail.notFound", { defaultValue: "Reservation not found." }));
        setEvents([]);
      } else if (data.id) {
        void fetchEvents(data.id);
      }
      setReservation(data);
    } catch (err: any) {
      const message =
        typeof err?.message === "string"
          ? err.message
          : t("pclab.detail.loadFailed", { defaultValue: "Failed to load reservation." });
      setError(message);
      setReservation(null);
      setEvents([]);
      setEventsError(t("pclab.detail.historyLoadFailed", { defaultValue: "Failed to load history." }));
    } finally {
      setLoading(false);
    }
  }, [fetchEvents, reservationId, t]);

  const normalizedStatus = useMemo(() => {
    const value = (reservation?.status || "PENDING").toUpperCase();
    return (["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(value) ? value : "PENDING") as Status;
  }, [reservation?.status]);

  const updateStatus = useCallback(
    async (nextStatus: Status) => {
      if (!canReview || !reservation?.id) return;
      setActionLoading(true);
      setPendingAction(nextStatus);
      setError(null);
      try {
        const res: any = await (client as any).mutations.setPCLabReservationStatus(
          { id: reservation.id, status: nextStatus, statusNotes: reviewNote || undefined },
          { authMode: "userPool" }
        );
        const updated = (res?.data as Reservation | undefined) ?? null;
        if (!updated) {
          throw new Error("Empty response from status update.");
        }
        setReservation(updated);
        setReviewNote("");
        if (updated.id) {
          void fetchEvents(updated.id);
        }
        emitPCLabQueueRefresh({ reservationId: updated.id, status: updated.status as Status });
        toast({
          title: t("pclab.detail.statusUpdatedTitle", { defaultValue: "Status updated" }),
          description: t("pclab.detail.statusUpdatedDesc", {
            defaultValue: "Reservation is now {{status}}.",
            status: statusLabels[(updated.status as Status) || nextStatus] || nextStatus,
          }),
        });
      } catch (err: any) {
        const fallback = t("pclab.detail.updateFailed", { defaultValue: "Failed to update reservation." });
        setError(typeof err?.message === "string" ? err.message : fallback);
        toast({
          variant: "destructive",
          title: t("pclab.detail.statusUpdateFailedTitle", { defaultValue: "Could not update status" }),
          description: typeof err?.message === "string" ? err.message : fallback,
        });
      } finally {
        setActionLoading(false);
        setPendingAction(null);
      }
    },
    [canReview, reservation?.id, reviewNote, t, fetchEvents, toast]
  );

  const handleApprove = useCallback(() => {
    void updateStatus("APPROVED");
  }, [updateStatus]);

  const handleReject = useCallback(() => {
    const confirmed = window.confirm(
      t("pclab.detail.confirmReject", { defaultValue: "Reject this reservation? This cannot be undone." })
    );
    if (!confirmed) return;
    void updateStatus("REJECTED");
  }, [t, updateStatus]);

  useEffect(() => {
    void loadReservation();
  }, [loadReservation]);

  if (loading || userLoading || groupsLoading) {
    return <Loader variant="page" />;
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              {t("pclab.detail.notAuthorized", { defaultValue: "You are not allowed to view this reservation." })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="outline" onClick={() => navigate(-1)}>
              {t("back", { defaultValue: "Back" })}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!reservation) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">
            {t("pclab.detail.breadcrumb", { defaultValue: "PC Lab Reservation" })}
          </p>
          <h1 className="text-3xl font-semibold">{reservation.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {reservation.email} • {reservation.reservationDate} • {reservation.startTime} - {reservation.endTime}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <StatusBadge status={reservation.status as Status} />
          <Button variant="outline" onClick={() => navigate("/dashboard/pc-lab-reservation")}>
            {t("deviceLoan.backToList", { defaultValue: "Back to requests" })}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("pclab.detail.summary", { defaultValue: "Reservation Summary" })}</CardTitle>
          <CardDescription>
            {t("pclab.detail.summaryDesc", { defaultValue: "Review the details submitted by the requester." })}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <DetailRow label={t("fullName", { defaultValue: "Full Name" })} value={reservation.fullName} />
          <DetailRow label={t("email", { defaultValue: "Email" })} value={reservation.email} />
          <DetailRow label={t("pclab.detail.date", { defaultValue: "Reservation Date" })} value={reservation.reservationDate} />
          <DetailRow label={t("pclab.detail.time", { defaultValue: "Time" })} value={`${reservation.startTime} - ${reservation.endTime}`} />
          <DetailRow label={t("pclab.form.pcsNeeded", { defaultValue: "PCs Needed" })} value={reservation.pcsNeeded} />
          <DetailRow
            label={t("pclab.form.numberOfStudents", { defaultValue: "Number of Students" })}
            value={reservation.numberOfStudents ?? t("pclab.detail.notProvided", { defaultValue: "Not provided" })}
          />
          <DetailRow
            label={t("pclab.form.monitor", { defaultValue: "Needs monitor?" })}
            value={reservation.needsMonitor ? t("pclab.form.yes", { defaultValue: "Yes" }) : t("pclab.form.no", { defaultValue: "No" })}
          />
          <DetailRow
            label={t("pclab.detail.createdAt", { defaultValue: "Submitted at" })}
            value={reservation.createdAt ? new Date(reservation.createdAt).toLocaleString() : "—"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("pclab.form.extraComments", { defaultValue: "Extra Comments" })}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {reservation.extraComments?.trim() ||
              t("pclab.detail.noComments", { defaultValue: "No comments were provided for this reservation." })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("pclab.detail.historyTitle", { defaultValue: "History" })}</CardTitle>
          <CardDescription>
            {t("pclab.detail.historyDesc", { defaultValue: "Activity log for this reservation." })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <p className="text-sm text-muted-foreground">
              {t("pclab.detail.historyLoading", { defaultValue: "Loading history..." })}
            </p>
          ) : eventsError ? (
            <p className="text-sm text-red-600">{eventsError}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("pclab.detail.historyEmpty", { defaultValue: "No events recorded yet." })}
            </p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <HistoryRow key={`${event.reservationId}-${event.changedAt}-${event.changedBySub}`} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canReview && (
        <Card>
          <CardHeader>
            <CardTitle>{t("pclab.detail.reviewerActions", { defaultValue: "Reviewer Actions" })}</CardTitle>
            <CardDescription>
              {t("pclab.detail.reviewerActionsDesc", { defaultValue: "Approve or reject this reservation." })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reviewNotes">{t("pclab.detail.reviewerNotes", { defaultValue: "Reviewer notes" })}</Label>
              <Textarea
                id="reviewNotes"
                rows={4}
                value={reviewNote}
                placeholder={t("pclab.detail.notePlaceholder", { defaultValue: "Add optional details for the requester..." })}
                onChange={(event) => setReviewNote(event.target.value)}
                disabled={actionLoading}
              />
            </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={actionLoading || normalizedStatus === "APPROVED" || normalizedStatus === "CANCELLED"}
          onClick={handleApprove}
        >
          {actionLoading && pendingAction === "APPROVED"
            ? t("pclab.detail.updating", { defaultValue: "Updating..." })
            : t("status.approved", { defaultValue: "Approve" })}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="w-full sm:w-auto"
          disabled={actionLoading || normalizedStatus === "REJECTED" || normalizedStatus === "CANCELLED"}
          onClick={handleReject}
        >
          {actionLoading && pendingAction === "REJECTED"
            ? t("pclab.detail.updating", { defaultValue: "Updating..." })
            : t("status.rejected", { defaultValue: "Reject" })}
        </Button>
      </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
