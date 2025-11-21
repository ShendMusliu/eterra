import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, Loader2, X } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { generateClient } from "aws-amplify/data";
import { getUrl } from "aws-amplify/storage";
import type { Schema } from "../../../amplify/data/resource";
import { RoleSelector } from "@/components/RoleSelector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { USER_ROLES, UserRole, isUserRole } from "../../../shared/userRoles";
import {
  USER_ROLE_IMPORT_HEADERS,
  parseUserRoleImportCsv,
  type UserRoleImportRow,
} from "../../../shared/userRoleImport";
import { readCsvFileContents } from "@/lib/csvEncoding";

const client = generateClient<Schema>();

type RoleAssignment = Schema["UserRoleAssignment"]["type"];
type BulkUpdateMutationResult = {
  updatedCount: number;
  failedCount: number;
  successes: Array<{ primaryEmail: string; roles: string[] }>;
  failures: Array<{ primaryEmail: string; reason: string }>;
};
type BulkOperationResult = {
  failedCount: number;
  failures: Array<{ primaryEmail: string; reason: string }> | null | undefined;
  updatedCount?: number;
  deletedCount?: number;
};
type BulkDeleteResult = {
  deletedCount: number;
  failedCount: number;
  successes: Array<{ primaryEmail: string }> | null | undefined;
  failures: Array<{ primaryEmail: string; reason: string }> | null | undefined;
};

type UserRoleImportJob = Schema["UserRoleImportJob"]["type"];

type CognitoSyncFailure = {
  email?: string | null;
  reason: string;
};

type CognitoSyncResult = {
  createdCount: number;
  skippedCount: number;
  missingEmailCount: number;
  failedCount: number;
  totalCognitoUsers: number;
  totalAssignmentsBefore: number;
  totalAssignmentsAfter: number;
  failures: CognitoSyncFailure[];
};

const RECENT_COUNT = 5;
const PAGE_SIZE = 25;
const COGNITO_SYNC_STATE_ID = "COGNITO_SYNC_STATE";

function getAssignmentTimestamp(assignment: RoleAssignment) {
  const value = assignment.updatedAt ?? assignment.createdAt;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortAssignmentsByUpdated(assignments: RoleAssignment[]) {
  return [...assignments].sort((a, b) => getAssignmentTimestamp(b) - getAssignmentTimestamp(a));
}

const userRoleSchema = z.enum([...USER_ROLES] as [UserRole, ...UserRole[]]);

const formSchema = z.object({
  primaryEmail: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email")
    .transform((val) => val.trim().toLowerCase()),
  roles: z.array(userRoleSchema).min(1, "At least one role is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
const bulkFormSchema = z.object({
  action: z.enum(["ADD", "REMOVE"]),
  roles: z.array(userRoleSchema).min(1, "Select at least one role."),
});

type BulkFormValues = z.infer<typeof bulkFormSchema>;

function normalizeList(values: readonly (string | null | undefined)[] | undefined | null) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value): value is string => value.length > 0);
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  return fallback;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

function joinErrorMessages(errors?: ReadonlyArray<{ message?: string }> | null) {
  if (!errors?.length) {
    return "Unknown error";
  }
  return errors.map((error) => error?.message ?? "Unknown error").join(", ");
}

export default function UserRoleAssignmentsPage() {
  const { t } = useTranslation();
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [syncingCognito, setSyncingCognito] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [lastCognitoSyncAt, setLastCognitoSyncAt] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [allAccounts, setAllAccounts] = useState<RoleAssignment[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allNextToken, setAllNextToken] = useState<string | null>(null);
  const [allPrevTokens, setAllPrevTokens] = useState<(string | null)[]>([]);
  const [allCurrentToken, setAllCurrentToken] = useState<string | null>(null);
  const [allPageNumber, setAllPageNumber] = useState(1);
  const [searchEmailInput, setSearchEmailInput] = useState("");
  const [searchRoleInput, setSearchRoleInput] = useState("");
  const [activeEmailFilter, setActiveEmailFilter] = useState("");
  const [activeRoleFilter, setActiveRoleFilter] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFileContents, setImportFileContents] = useState<string>("");
  const [importPreview, setImportPreview] = useState<UserRoleImportRow[]>([]);
  const [importParseErrors, setImportParseErrors] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [activeImportJobId, setActiveImportJobId] = useState<string | null>(null);
  const [activeImportJob, setActiveImportJob] = useState<UserRoleImportJob | null>(null);
  const [completedImportJob, setCompletedImportJob] = useState<UserRoleImportJob | null>(null);
  const [bulkSelecting, setBulkSelecting] = useState(false);
  const [bulkSelectedEmails, setBulkSelectedEmails] = useState<string[]>([]);
  const [bulkEditActive, setBulkEditActive] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkOperationResult | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [lastBulkSelectionIndex, setLastBulkSelectionIndex] = useState<number | null>(null);

  const importStats = useMemo(() => {
    const total = importPreview.length;
    const invalid = importPreview.filter((row) => row.errors.length > 0).length;
    const valid = total - invalid;
    const warnings = importPreview.filter((row) => row.warnings.length > 0 && row.errors.length === 0).length;
    return { total, valid, invalid, warnings };
  }, [importPreview]);

  const previewErrorRows = useMemo(
    () => importPreview.filter((row) => row.errors.length > 0).slice(0, 5),
    [importPreview]
  );
  const previewWarningRows = useMemo(
    () => importPreview.filter((row) => row.warnings.length > 0 && row.errors.length === 0).slice(0, 5),
    [importPreview]
  );

  type LoadAllOptions = {
    token?: string | null;
    reset?: boolean;
    pushPrev?: boolean;
    popPrev?: boolean;
    previousToken?: string | null;
  };

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      primaryEmail: "",
      roles: [],
      notes: "",
    },
  });

  const {
    control: bulkControl,
    handleSubmit: handleBulkSubmit,
    reset: resetBulkForm,
    setValue: setBulkValue,
    watch: watchBulkForm,
    formState: { errors: bulkErrors, isSubmitting: isBulkSubmitting },
  } = useForm<BulkFormValues>({
    resolver: zodResolver(bulkFormSchema),
    defaultValues: {
      action: "ADD",
      roles: [],
    },
  });

  const bulkAction = watchBulkForm("action");
  const bulkSelectionSet = useMemo(() => new Set(bulkSelectedEmails), [bulkSelectedEmails]);
  const bulkSelectionCount = bulkSelectedEmails.length;
  const bulkOperationInProgress = isBulkSubmitting || isBulkDeleting;
  const pageEmails = useMemo(
    () => allAccounts.map((account) => account.primaryEmail),
    [allAccounts]
  );
  const isPageFullySelected = useMemo(
    () =>
      pageEmails.length > 0 &&
      pageEmails.every((email) => bulkSelectionSet.has(email)),
    [pageEmails, bulkSelectionSet]
  );

  const bulkFailureList = useMemo(
    () => (Array.isArray(bulkResult?.failures) ? bulkResult!.failures : []),
    [bulkResult]
  );

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const listRes: any = await client.models.UserRoleAssignment.list({
        limit: 200,
        authMode: "userPool",
      });
      if (listRes.errors?.length) {
        throw new Error(joinErrorMessages(listRes.errors));
      }
      const items = sortAssignmentsByUpdated((listRes.data ?? []) as RoleAssignment[]);
      setAssignments(items);
    } catch (error: unknown) {
      console.error("Failed to load account registry", error);
      setFetchError(
        toErrorMessage(
          error,
          t("roleAssignments.errorLoad", { defaultValue: "Failed to load accounts." })
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCognitoSyncTimestamp = useCallback(async (): Promise<string | null> => {
    try {
      const response: any = await (client as any).models.CognitoSyncState.get(
        { id: COGNITO_SYNC_STATE_ID },
        { authMode: "userPool" }
      );
      if (response.errors?.length) {
        const notFound = response.errors.every((error: { message?: string }) =>
          typeof error?.message === "string" && /not\s+found|no\s+item/i.test(error.message)
        );
        if (notFound) {
          return null;
        }
        console.warn("Failed to load Cognito sync state", response.errors);
        return null;
      }
      const value = response.data?.lastRunAt;
      return typeof value === "string" && value.length > 0 ? value : null;
    } catch (error) {
      console.warn("Failed to load Cognito sync state", error);
      return null;
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    if (bulkSelectedEmails.length === 0) {
      setBulkEditActive(false);
      setBulkResult(null);
      setLastBulkSelectionIndex(null);
    }
  }, [bulkSelectedEmails]);

  useEffect(() => {
    let isActive = true;
    void (async () => {
      const timestamp = await fetchCognitoSyncTimestamp();
      if (!isActive) return;
      setLastCognitoSyncAt(timestamp);
    })();
    return () => {
      isActive = false;
    };
  }, [fetchCognitoSyncTimestamp]);

  const loadAllAssignments = useCallback(
    async (options: LoadAllOptions = {}) => {
      const { token = null, reset = false, pushPrev = false, popPrev = false, previousToken = null } = options;
      setAllLoading(true);
      try {
        const filters: any[] = [];
        if (activeEmailFilter) {
          filters.push({
            primaryEmail: { contains: activeEmailFilter },
          });
        }
        if (activeRoleFilter) {
          filters.push({
            roles: { contains: activeRoleFilter },
          });
        }
        let filter: any | undefined;
        if (filters.length === 1) {
          filter = filters[0];
        } else if (filters.length > 1) {
          filter = { and: filters };
        }

        const shouldSkipEmptyPages = Boolean(filter);
        let pageToken = token ?? undefined;
        let pageItems: RoleAssignment[] = [];
        let pageNextToken: string | null | undefined;
        let effectiveToken: string | null = pageToken ?? null;
        let safetyCounter = 0;

        do {
          const listRes: any = await client.models.UserRoleAssignment.list({
            limit: PAGE_SIZE,
            nextToken: pageToken,
            filter,
            authMode: "userPool",
          });
          if (listRes.errors?.length) {
            throw new Error(joinErrorMessages(listRes.errors));
          }
          pageItems = sortAssignmentsByUpdated((listRes.data ?? []) as RoleAssignment[]);
          pageNextToken = listRes.nextToken ?? null;
          effectiveToken = pageToken ?? null;

          if (!shouldSkipEmptyPages || pageItems.length > 0 || !pageNextToken) {
            break;
          }

          pageToken = pageNextToken ?? undefined;
          safetyCounter += 1;
        } while (safetyCounter < 25);

        setAllAccounts(pageItems);
        setAllNextToken(pageNextToken ?? null);
        setAllCurrentToken(effectiveToken);
        setAllPrevTokens((prev) => {
          if (reset) return [];
          if (pushPrev) {
            return [...prev, previousToken ?? null];
          }
          if (popPrev) {
            if (prev.length === 0) return [];
            return prev.slice(0, prev.length - 1);
          }
          return prev;
        });
        setAllPageNumber((prev) => {
          if (reset) return 1;
          if (pushPrev) return prev + 1;
          if (popPrev) return Math.max(1, prev - 1);
          return prev;
        });
      } catch (error) {
        console.error("Failed to load account registry (modal)", error);
        setStatusMessage(
          toErrorMessage(
            error,
            t("roleAssignments.errorLoad", { defaultValue: "Failed to load accounts." })
          )
        );
      } finally {
        setAllLoading(false);
      }
    },
    [activeEmailFilter, activeRoleFilter, client, t]
  );

  useEffect(() => {
    if (!showAllAccounts) return;
    setSearchEmailInput(activeEmailFilter);
    setSearchRoleInput(activeRoleFilter);
    loadAllAssignments({ token: null, reset: true });
  }, [showAllAccounts, activeEmailFilter, activeRoleFilter, loadAllAssignments]);

  const onSubmit = handleSubmit(async (values) => {
    setStatusMessage(null);
    try {
      const roles = [...values.roles];

      const normalizedEmail = values.primaryEmail;
      const isChangingEmail = editingEmail ? normalizedEmail !== editingEmail : true;
      if (isChangingEmail) {
        const existingRecords = [...assignments, ...allAccounts];
        const duplicate = existingRecords.some(
          (assignment) =>
            assignment?.primaryEmail === normalizedEmail &&
            (editingUserId ? assignment?.id !== editingUserId : true)
        );
        if (duplicate) {
          const message = t("roleAssignments.emailExists", {
            defaultValue: "An account with this email already exists. Click Edit to update it instead.",
          });
          setError("primaryEmail", { type: "manual", message });
          setStatusMessage(message);
          return;
        }
      }

      const payload = {
        primaryEmail: normalizedEmail,
        roles,
        notes: values.notes?.trim() ? values.notes.trim() : undefined,
        ...(editingUserId ? { userId: editingUserId } : {}),
      };
      const mutation = await client.mutations.adminUpsertUserRoleAssignment(payload, {
        authMode: "userPool",
      });
      if (mutation.errors?.length) {
        throw new Error(joinErrorMessages(mutation.errors));
      }
      setStatusMessage(
        editingEmail
          ? t("roleAssignments.updated", { defaultValue: "Account updated." })
          : t("roleAssignments.created", { defaultValue: "Account created." })
      );
      setEditingEmail(null);
      setEditingUserId(null);
      reset({
        primaryEmail: "",
        roles: [],
        notes: "",
      });
      await loadAssignments();
      if (showAllAccounts) {
        await loadAllAssignments({ token: null, reset: true });
      }
    } catch (error: unknown) {
      console.error("Failed to save account changes", error);
      setStatusMessage(
        toErrorMessage(
          error,
          t("roleAssignments.errorSave", { defaultValue: "Failed to save account changes." })
        )
      );
    }
  });

  const onBulkSubmit = handleBulkSubmit(async (values) => {
    if (bulkSelectedEmails.length < 2) {
      setBulkError(
        t("roleAssignments.bulkSelectionMinimum", {
          defaultValue: "Select at least two accounts to continue.",
        })
      );
      return;
    }
    try {
      setBulkError(null);
      setBulkResult(null);
      const payload = {
        primaryEmails: bulkSelectedEmails,
        roles: values.roles,
        action: values.action,
      };
      const mutation = await client.mutations.adminBulkUpdateUserRoles(payload, {
        authMode: "userPool",
      });
      if (mutation.errors?.length) {
        throw new Error(joinErrorMessages(mutation.errors));
      }
      const result = (mutation.data ?? null) as BulkUpdateMutationResult | null;
      if (!result) {
        throw new Error(
          t("roleAssignments.bulkNoResult", {
            defaultValue: "Bulk role update did not return a summary.",
          })
        );
      }
      const summary = t("roleAssignments.bulkSummary", {
        defaultValue: "Updated {{updated}} accounts. {{failed}} failures.",
        updated: result.updatedCount,
        failed: result.failedCount,
      });
      setStatusMessage(summary);

      if (result.failedCount > 0 && result.failures?.length) {
        setBulkResult({
          failedCount: result.failedCount,
          failures: result.failures ?? [],
          updatedCount: result.updatedCount,
        });
        setBulkSelectedEmails(result.failures.map((failure) => failure.primaryEmail));
        setBulkEditActive(true);
      } else {
        setBulkResult(null);
        clearBulkSelection();
      }

      await loadAssignments();
      if (showAllAccounts) {
        await loadAllAssignments({ token: allCurrentToken ?? null });
      }
    } catch (error: unknown) {
      console.error("Failed to apply bulk role update", error);
      setBulkError(
        toErrorMessage(
          error,
          t("roleAssignments.bulkError", {
            defaultValue: "Failed to update roles for the selected accounts.",
          })
        )
      );
    }
  });

  const handleEdit = useCallback(
    (assignment: RoleAssignment) => {
      setEditingEmail(assignment.primaryEmail);
      setEditingUserId(assignment.id ?? null);
      const rolesForForm = normalizeList(assignment.roles).filter(isUserRole);
      reset({
        primaryEmail: assignment.primaryEmail,
        roles: rolesForForm,
        notes: assignment.notes ?? "",
      });
      setStatusMessage(
        t("roleAssignments.editing", {
          defaultValue: "Editing {email}. Update account details and save.",
          email: assignment.primaryEmail,
        })
      );
    },
    [reset, t]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingEmail(null);
    setEditingUserId(null);
    reset({
      primaryEmail: "",
      roles: [],
      notes: "",
    });
    setStatusMessage(null);
  }, [reset]);

  const handleDelete = useCallback(
    async (email: string) => {
      const confirmed = window.confirm(
        t("roleAssignments.confirmDelete", {
          defaultValue: "Remove account entry for {email}?",
          email,
        })
      );
      if (!confirmed) return;

      const normalizedEmail = email.trim().toLowerCase();
      try {
        const assignmentFromState =
          assignments.find(
            (item) => item.primaryEmail?.toLowerCase() === normalizedEmail
          ) ??
          allAccounts.find(
            (item) => item.primaryEmail?.toLowerCase() === normalizedEmail
          );

        let assignment: RoleAssignment | null = assignmentFromState ?? null;

        if (!assignment) {
          const lookup = await client.models.UserRoleAssignment.list({
            filter: { primaryEmailLower: { eq: normalizedEmail } },
            limit: 2,
            authMode: "userPool",
          });
          if (lookup.errors?.length) {
            throw new Error(joinErrorMessages(lookup.errors));
          }
          assignment =
            (lookup.data ?? []).find(
              (item: RoleAssignment | null): item is RoleAssignment => Boolean(item)
            ) ?? null;
        }

        if (!assignment?.id) {
          throw new Error(
            t("roleAssignments.errorDeleteNotFound", {
              defaultValue: "Account record could not be located.",
            })
          );
        }

        const result = await client.models.UserRoleAssignment.delete(
          { id: assignment.id },
          { authMode: "userPool" }
        );
        if (result.errors?.length) {
          throw new Error(joinErrorMessages(result.errors));
        }
        if (editingEmail === email) {
          handleCancelEdit();
        }
        setBulkSelectedEmails((prev) => prev.filter((value) => value !== email));
        setStatusMessage(
          t("roleAssignments.deleted", {
            defaultValue: "Removed account for {email}.",
            email,
          })
        );
        await loadAssignments();
        if (showAllAccounts) {
          await loadAllAssignments({ token: allCurrentToken });
        }
      } catch (error: unknown) {
        console.error("Failed to delete account", error);
        setStatusMessage(
          toErrorMessage(
            error,
            t("roleAssignments.errorDelete", { defaultValue: "Failed to delete account." })
          )
        );
      }
    },
    [allAccounts, allCurrentToken, assignments, editingEmail, handleCancelEdit, loadAllAssignments, loadAssignments, showAllAccounts, t]
  );

  const handleImportClick = useCallback(() => {
    setImportFile(null);
    setImportFileContents("");
    setImportPreview([]);
    setImportParseErrors([]);
    setImportError(null);
    setActiveImportJob(null);
    setActiveImportJobId(null);
    setCompletedImportJob(null);
    setStatusMessage(null);
    setShowImportModal(true);
  }, []);

  const handleImportFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImportFile(file);
    setImportFileContents("");
    setImportPreview([]);
    setImportParseErrors([]);
    setImportError(null);
    setActiveImportJob(null);
    setActiveImportJobId(null);
    setCompletedImportJob(null);

    if (!file) {
      return;
    }

    void readCsvFileContents(file)
      .then(({ text }) => {
        setImportFileContents(text);
        if (!text.trim()) {
          setImportPreview([]);
          setImportParseErrors([
            t("roleAssignments.importEmpty", { defaultValue: "The selected CSV file is empty." }),
          ]);
          return;
        }
        const result = parseUserRoleImportCsv(text);
        setImportParseErrors(result.errors ?? []);
        setImportPreview(result.rows);
      })
      .catch((error) => {
        console.error("Failed to read CSV file", error);
        setImportPreview([]);
        setImportParseErrors([]);
        setImportFileContents("");
        setImportError(
          t("roleAssignments.importError", { defaultValue: "Failed to read the selected CSV file." })
        );
      });
  }, [t]);

  const handleDownloadImportResult = useCallback(
    async (job: UserRoleImportJob) => {
      if (!job.resultS3Key) return;
      try {
        const { url } = await getUrl({
          path: job.resultS3Key,
          options: { expiresIn: 300 },
        });
        window.open(url.href, "_blank", "noopener,noreferrer");
      } catch (error) {
        console.error("Failed to download user role import results", error);
        setImportError(
          toErrorMessage(
            error,
            t("roleAssignments.importDownloadError", {
              defaultValue: "Failed to download import results.",
            })
          )
        );
      }
    },
    [t]
  );

  const handleDownloadTemplate = useCallback(() => {
    const encodeValue = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const sampleRows = [
      {
        primaryEmail: "teacher@kla.education",
        roles: "Teacher,Staff",
        notes: "Optional note for auditors",
      },
      {
        primaryEmail: "parent@kla.education",
        roles: "Parent",
        notes: "",
      },
    ];

    const csvLines = [
      USER_ROLE_IMPORT_HEADERS.join(","),
      ...sampleRows.map((row) =>
        [
          encodeValue(row.primaryEmail),
          encodeValue(row.roles),
          encodeValue(row.notes),
        ].join(",")
      ),
    ];

    const blob = new Blob([csvLines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "user-accounts-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatusMessage(
      t("roleAssignments.templateDownloaded", { defaultValue: "Sample CSV downloaded." })
    );
  }, [t]);

  const toggleBulkSelectMode = useCallback(() => {
    setBulkSelecting((prev) => !prev);
    setBulkError(null);
    setBulkResult(null);
    setLastBulkSelectionIndex(null);
  }, []);

  const handleBulkCheckboxChange = useCallback(
    (email: string, rowIndex: number, shiftKey: boolean, nextChecked: boolean) => {
      setBulkSelectedEmails((prev) => {
        const nextSet = new Set(prev);
        const apply = (targetEmails: string[]) => {
          targetEmails.forEach((targetEmail) => {
            if (nextChecked) {
              nextSet.add(targetEmail);
            } else {
              nextSet.delete(targetEmail);
            }
          });
        };

        if (
          shiftKey &&
          lastBulkSelectionIndex !== null &&
          allAccounts.length > 0 &&
          lastBulkSelectionIndex >= 0 &&
          lastBulkSelectionIndex < allAccounts.length
        ) {
          const start = Math.max(0, Math.min(lastBulkSelectionIndex, rowIndex));
          const end = Math.min(allAccounts.length - 1, Math.max(lastBulkSelectionIndex, rowIndex));
          const rangeEmails = allAccounts.slice(start, end + 1).map((account) => account.primaryEmail);
          apply(rangeEmails);
        } else {
          apply([email]);
        }

        return Array.from(nextSet).sort();
      });
      setLastBulkSelectionIndex(rowIndex);
      setBulkError(null);
      setBulkResult(null);
    },
    [allAccounts, lastBulkSelectionIndex]
  );

  const handleBulkSelectAllOnPage = useCallback(() => {
    if (pageEmails.length === 0) {
      return;
    }
    setBulkSelectedEmails((prev) => {
      const next = new Set(prev);
      pageEmails.forEach((email) => next.add(email));
      return Array.from(next).sort();
    });
    setBulkError(null);
    setBulkResult(null);
    setLastBulkSelectionIndex(allAccounts.length > 0 ? allAccounts.length - 1 : null);
  }, [allAccounts, pageEmails]);

  const handleBulkDeselectPage = useCallback(() => {
    if (pageEmails.length === 0) {
      return;
    }
    setBulkSelectedEmails((prev) =>
      prev.filter((email) => !pageEmails.includes(email))
    );
    setBulkError(null);
    setBulkResult(null);
    setLastBulkSelectionIndex(null);
  }, [pageEmails]);

  const handleBulkRemoveEmail = useCallback((email: string) => {
    setBulkSelectedEmails((prev) => prev.filter((value) => value !== email));
    setBulkError(null);
    setBulkResult(null);
  }, []);

  const clearBulkSelection = useCallback(() => {
    setBulkSelectedEmails([]);
    setBulkSelecting(false);
    setBulkEditActive(false);
    setBulkError(null);
    setBulkResult(null);
    setIsBulkDeleting(false);
    setLastBulkSelectionIndex(null);
    resetBulkForm({ action: bulkAction ?? "ADD", roles: [] });
  }, [bulkAction, resetBulkForm]);

  const handleAllAccountsOpenChange = useCallback(
    (open: boolean) => {
      setShowAllAccounts(open);
      if (!open) {
        setBulkSelecting(false);
        setBulkError(null);
        setBulkResult(null);
        setIsBulkDeleting(false);
        setLastBulkSelectionIndex(null);
      }
    },
    []
  );

  const handleBulkContinue = useCallback(() => {
    if (bulkSelectedEmails.length < 2) {
      setBulkError(
        t("roleAssignments.bulkSelectionMinimum", {
          defaultValue: "Select at least two accounts to continue.",
        })
      );
      return;
    }
    setBulkError(null);
    setBulkResult(null);
    setBulkEditActive(true);
    setBulkSelecting(false);
    resetBulkForm({ action: bulkAction ?? "ADD", roles: [] });
    handleAllAccountsOpenChange(false);
  }, [bulkSelectedEmails, bulkAction, resetBulkForm, handleAllAccountsOpenChange, t]);

  const handleBulkDelete = useCallback(async () => {
    if (bulkSelectedEmails.length === 0) {
      setBulkError(
        t("roleAssignments.bulkDeleteMinimum", {
          defaultValue: "Select at least one account to delete.",
        })
      );
      return;
    }
    const confirmed = window.confirm(
      t("roleAssignments.bulkDeleteConfirm", {
        defaultValue: "Delete {{count}} account(s)? This cannot be undone.",
        count: bulkSelectedEmails.length,
      })
    );
    if (!confirmed) {
      return;
    }
    setIsBulkDeleting(true);
    setBulkError(null);
    setBulkResult(null);
    try {
      const mutation = await client.mutations.adminDeleteUserRoleAssignments(
        { primaryEmails: bulkSelectedEmails },
        { authMode: "userPool" }
      );
      if (mutation.errors?.length) {
        throw new Error(joinErrorMessages(mutation.errors));
      }
      const result = (mutation.data ?? null) as BulkDeleteResult | null;
      if (!result) {
        throw new Error(
          t("roleAssignments.bulkDeleteNoResult", {
            defaultValue: "Bulk delete did not return a summary.",
          })
        );
      }
      const failuresArray = Array.isArray(result.failures) ? result.failures : [];
      const successesArray = Array.isArray(result.successes) ? result.successes : [];
      const summary = t("roleAssignments.bulkDeleteSummary", {
        defaultValue: "Deleted {{deleted}} accounts. {{failed}} failures.",
        deleted: result.deletedCount,
        failed: result.failedCount,
      });
      setStatusMessage(summary);

      if (result.failedCount > 0 && failuresArray.length > 0) {
        setBulkResult({
          failedCount: result.failedCount,
          failures: failuresArray,
          deletedCount: result.deletedCount,
        });
        setBulkSelectedEmails(failuresArray.map((failure) => failure.primaryEmail));
        setBulkEditActive(true);
      } else {
        setBulkResult(null);
        clearBulkSelection();
      }

      await loadAssignments();
      if (showAllAccounts) {
        await loadAllAssignments({ token: allCurrentToken ?? null });
      }
    } catch (error: unknown) {
      console.error("Failed to delete role assignments", error);
      setBulkError(
        toErrorMessage(
          error,
          t("roleAssignments.bulkDeleteError", {
            defaultValue: "Failed to delete the selected accounts.",
          })
        )
      );
    } finally {
      setIsBulkDeleting(false);
    }
  }, [
    allCurrentToken,
    bulkSelectedEmails,
    clearBulkSelection,
    client,
    loadAllAssignments,
    loadAssignments,
    showAllAccounts,
    clearBulkSelection,
    loadAllAssignments,
    loadAssignments,
    showAllAccounts,
    t,
  ]);


  const handleImportConfirm = useCallback(async () => {
    if (!importFile) {
      setImportError(t("roleAssignments.importNoFile", { defaultValue: "Please choose a CSV file." }));
      return;
    }
    if (importPreview.length === 0) {
      setImportError(
        t("roleAssignments.importNoRows", { defaultValue: "The selected CSV did not contain any rows." })
      );
      return;
    }
    if (importStats.valid === 0) {
      setImportError(
        t("roleAssignments.importResolveErrors", {
          defaultValue: "Resolve the highlighted rows before starting the import.",
        })
      );
      return;
    }
    if (importParseErrors.length > 0) {
      setImportError(importParseErrors.join("\n"));
      return;
    }

    setImporting(true);
    setImportError(null);
    setCompletedImportJob(null);
    setActiveImportJob(null);

    try {
      let csvText = importFileContents;
      if (!csvText) {
        const { text } = await readCsvFileContents(importFile);
        setImportFileContents(text);
        csvText = text;
      }
      if (!csvText.trim()) {
        const message = t("roleAssignments.importEmpty", { defaultValue: "The selected CSV file is empty." });
        setImportError(message);
        setImporting(false);
        return;
      }

      const response = await client.mutations.adminStartUserRoleImport(
        {
          csv: csvText,
          fileName: importFile.name,
        },
        { authMode: "userPool" }
      );

      if (response.errors?.length) {
        throw new Error(joinErrorMessages(response.errors));
      }

      const job = (response.data ?? null) as UserRoleImportJob | null;
      if (!job) {
        throw new Error(
          t("roleAssignments.importStartFailed", {
            defaultValue: "Failed to start the user role import job.",
          })
        );
      }

      setActiveImportJobId(job.id);
      setActiveImportJob(job);
      setStatusMessage(
        t("roleAssignments.importJobQueued", {
          defaultValue: "Import queued. Job ID: {{id}}",
          id: job.id,
        })
      );
    } catch (error: unknown) {
      console.error("Failed to queue user role import", error);
      const message = toErrorMessage(
        error,
        t("roleAssignments.importError", { defaultValue: "Failed to start the import." })
      );
      setImportError(message);
      setStatusMessage(message);
      setImporting(false);
    }
  }, [importFile, importFileContents, importParseErrors.length, importPreview.length, importStats.valid, t]);

  const handleImportModalOpenChange = useCallback((open: boolean) => {
    if (!open && importing) {
      return;
    }
    setShowImportModal(open);
    if (!open) {
      setImportFile(null);
      setImportFileContents("");
      setImportPreview([]);
      setImportParseErrors([]);
      setImportError(null);
      setActiveImportJob(null);
      setActiveImportJobId(null);
      setCompletedImportJob(null);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }
    }
  }, [importing]);

  useEffect(() => {
    if (!activeImportJobId) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const response = await client.models.UserRoleImportJob.get(
          { id: activeImportJobId },
          { authMode: "userPool" }
        );
        if (cancelled) return;
        if (response.errors?.length) {
          throw new Error(joinErrorMessages(response.errors));
        }
        const job = (response.data ?? null) as UserRoleImportJob | null;
        if (!job) {
          throw new Error("Import job not found.");
        }

        if (job.status === "SUCCEEDED" || job.status === "FAILED") {
          setCompletedImportJob(job);
          setImporting(false);
          setActiveImportJobId(null);
          setActiveImportJob(null);
          setStatusMessage(job.message ?? null);
          await loadAssignments();
          if (showAllAccounts) {
            await loadAllAssignments({ token: null, reset: true });
          }
          return;
        }

        setActiveImportJob(job);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to poll user role import job", error);
          setImportError(
            toErrorMessage(
              error,
              t("roleAssignments.importPollError", {
                defaultValue: "Failed to poll the import job status.",
              })
            )
          );
          setImporting(false);
          setActiveImportJobId(null);
        }
        return;
      }

      if (!cancelled) {
        timeoutId = setTimeout(poll, 5000);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeImportJobId, client.models, loadAllAssignments, loadAssignments, showAllAccounts, t]);

  const runSyncCognito = useCallback(async () => {
    setShowSyncConfirm(false);
    setSyncingCognito(true);
    setStatusMessage(
      t("roleAssignments.syncStatusRunning", {
        defaultValue: "Syncing Cognito invites...",
      })
    );
    try {
      const result = (await (client as any).mutations.adminSyncCognitoUsers(
        {},
        { authMode: "userPool" }
      )) as {
        data?: CognitoSyncResult | null;
        errors?: Array<{ message?: string }>;
      };
      if (result.errors?.length) {
        throw new Error(joinErrorMessages(result.errors));
      }
      const data = result.data;
      if (!data) {
        const message = t("roleAssignments.syncStatusNoData", {
          defaultValue: "Sync completed, but no summary was returned.",
        });
        setStatusMessage(message);
        return;
      }
      const summaryLines = [
        t("roleAssignments.syncStatusComplete", {
          defaultValue: "Sync completed.",
        }),
        t("roleAssignments.syncStatusCreated", {
          defaultValue: "Created: {{count}}",
          count: data.createdCount,
        }),
        t("roleAssignments.syncStatusSkipped", {
          defaultValue: "Already present: {{count}}",
          count: data.skippedCount,
        }),
        t("roleAssignments.syncStatusMissingEmail", {
          defaultValue: "Missing email in Cognito: {{count}}",
          count: data.missingEmailCount,
        }),
        t("roleAssignments.syncStatusFailed", {
          defaultValue: "Failed: {{count}}",
          count: data.failedCount,
        }),
        t("roleAssignments.syncStatusTotals", {
          defaultValue:
            "Cognito users scanned: {{total}} | Assignments before: {{before}} | After: {{after}}",
          total: data.totalCognitoUsers,
          before: data.totalAssignmentsBefore,
          after: data.totalAssignmentsAfter,
        }),
      ];
      if (data.failures?.length) {
        summaryLines.push(
          t("roleAssignments.syncStatusFailures", {
            defaultValue: "Failures (showing up to 5):",
          })
        );
        for (const failure of data.failures.slice(0, 5)) {
          summaryLines.push(
            `- ${
              failure.email ??
              t("roleAssignments.unknownEmail", { defaultValue: "Unknown email" })
            }: ${failure.reason}`
          );
        }
      }
      const summary = summaryLines.join("\n");
      setStatusMessage(summary);
      await loadAssignments();
      if (showAllAccounts) {
        await loadAllAssignments({ token: null, reset: true });
      }
      const finishedAt = new Date().toISOString();
      setLastCognitoSyncAt(finishedAt);
      const refreshedTimestamp = await fetchCognitoSyncTimestamp();
      if (refreshedTimestamp) {
        setLastCognitoSyncAt(refreshedTimestamp);
      }
    } catch (error: unknown) {
      console.error("Failed to sync Cognito users", error);
      const message = toErrorMessage(
        error,
        t("roleAssignments.syncStatusError", {
          defaultValue: "Failed to sync Cognito users.",
        })
      );
      setStatusMessage(message);
    } finally {
      setSyncingCognito(false);
    }
  }, [fetchCognitoSyncTimestamp, loadAllAssignments, loadAssignments, showAllAccounts, t]);

  const handleSyncConfirmOpenChange = useCallback(
    (open: boolean) => {
      if (!open && syncingCognito) {
        return;
      }
      setShowSyncConfirm(open);
    },
    [syncingCognito]
  );

  const handleSyncButtonClick = useCallback(() => {
    if (syncingCognito) return;
    setShowSyncConfirm(true);
  }, [syncingCognito]);

  const handleApplyFilters = useCallback(() => {
    setActiveEmailFilter(searchEmailInput.trim().toLowerCase());
    setActiveRoleFilter(searchRoleInput.trim());
  }, [searchEmailInput, searchRoleInput]);

  const handleClearFilters = useCallback(() => {
    setSearchEmailInput("");
    setSearchRoleInput("");
    setActiveEmailFilter("");
    setActiveRoleFilter("");
  }, []);

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleApplyFilters();
    },
    [handleApplyFilters]
  );

  const handleNextPage = useCallback(() => {
    if (!allNextToken) return;
    loadAllAssignments({ token: allNextToken, pushPrev: true, previousToken: allCurrentToken ?? null });
  }, [allNextToken, allCurrentToken, loadAllAssignments]);

  const handlePreviousPage = useCallback(() => {
    if (allPrevTokens.length === 0) return;
    const prevToken = allPrevTokens[allPrevTokens.length - 1] ?? null;
    loadAllAssignments({ token: prevToken, popPrev: true });
  }, [allPrevTokens, loadAllAssignments]);

  const recentAssignments = useMemo(
    () => assignments.slice(0, RECENT_COUNT),
    [assignments]
  );
  const hasMoreRecords = assignments.length > RECENT_COUNT;
  const tableSkeletonRows = useMemo(() => Array.from({ length: 5 }), []);
  const modalSkeletonRows = useMemo(() => Array.from({ length: 8 }), []);

  return (
    <div className="min-h-screen w-full bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3 py-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("roleAssignments.title", { defaultValue: "Manage user accounts" })}</h1>
          <p className="text-sm text-muted-foreground">
            {t("roleAssignments.subtitle", {
              defaultValue:
                "Create accounts ahead of first sign-in and manage the roles that flow into Cognito tokens.",
            })}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSyncButtonClick}
              disabled={syncingCognito || importing}
            >
              {syncingCognito ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  {t("roleAssignments.syncStatusRunning", {
                    defaultValue: "Syncing Cognito invites...",
                  })}
                </>
              ) : (
                t("roleAssignments.syncCognitoButton", {
                  defaultValue: "Sync Cognito invites",
                })
              )}
            </Button>
            <Button type="button" variant="default" onClick={handleImportClick} disabled={importing}>
              {t("roleAssignments.importCsv", { defaultValue: "Import CSV" })}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {lastCognitoSyncAt
              ? t("roleAssignments.syncConfirmLastRun", {
                  defaultValue: "Last sync: {{timestamp}}",
                  timestamp: formatDateTime(lastCognitoSyncAt),
                })
              : t("roleAssignments.syncConfirmLastRunNever", { defaultValue: "Last sync: never" })}
          </p>
        </div>
      </div>

      {statusMessage && !showImportModal ? (
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <Info className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
          <div className="whitespace-pre-line text-muted-foreground">{statusMessage}</div>
        </div>
      ) : null}

      <Dialog open={showSyncConfirm} onOpenChange={handleSyncConfirmOpenChange}>
        <DialogContent className="w-full max-w-[min(95vw,28rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("roleAssignments.syncConfirmTitle", { defaultValue: "Sync Cognito invites" })}
            </DialogTitle>
            <DialogDescription>
              {t("roleAssignments.syncConfirmDescription", {
                defaultValue:
                  "This will scan the Cognito user pool for invited accounts that are missing from the registry. Continue?",
              })}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {lastCognitoSyncAt
              ? t("roleAssignments.syncConfirmLastRun", {
                  defaultValue: "Last sync: {{timestamp}}",
                  timestamp: formatDateTime(lastCognitoSyncAt),
                })
              : t("roleAssignments.syncConfirmLastRunNever", { defaultValue: "Last sync: never" })}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSyncConfirm(false)}
              disabled={syncingCognito}
            >
              {t("roleAssignments.syncConfirmCancel", { defaultValue: "Cancel" })}
            </Button>
            <Button type="button" onClick={() => void runSyncCognito()} disabled={syncingCognito}>
              {t("roleAssignments.syncConfirmConfirm", { defaultValue: "Start sync" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportModal} onOpenChange={handleImportModalOpenChange}>
        <DialogContent className="w-full max-w-[min(95vw,40rem)] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("roleAssignments.importModalTitle", { defaultValue: "Import user accounts" })}</DialogTitle>
            <DialogDescription>
              {t("roleAssignments.importModalDescription", { defaultValue: "Upload a CSV to create or update accounts." })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("roleAssignments.importModalHint", {
                defaultValue: "Use the template to ensure headers match: primaryEmail, roles, notes.",
              })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={handleDownloadTemplate} disabled={importing}>
                {t("roleAssignments.downloadTemplate", { defaultValue: "Download template" })}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => importFileInputRef.current?.click()}
                disabled={importing}
              >
                {t("roleAssignments.importSelect", { defaultValue: "Choose CSV" })}
              </Button>
              <input
                ref={importFileInputRef}
                accept=".csv,text/csv"
                className="hidden"
                type="file"
                onChange={handleImportFileChange}
              />
              <span className="text-xs text-muted-foreground">
                {importFile
                  ? `${importFile.name}${
                      importFile.size ? ` (${Math.max(1, Math.round(importFile.size / 1024))} KB)` : ""
                    }`
                  : t("roleAssignments.importNoFileSelected", { defaultValue: "No file selected." })}
              </span>
            </div>
            {importError ? (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {importError}
              </p>
            ) : null}
            {importParseErrors.length > 0 ? (
              <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {importParseErrors.map((message, index) => (
                  <p key={`import-parse-error-${index}`}>{message}</p>
                ))}
              </div>
            ) : null}
            {importStats.total > 0 ? (
              <div className="space-y-3 rounded-md border border-border bg-muted/40 px-3 py-2">
                <div className="grid grid-cols-2 gap-3 text-xs font-medium text-muted-foreground sm:grid-cols-4">
                  <span>
                    {t("roleAssignments.importStatsTotal", {
                      defaultValue: "Rows: {{count}}",
                      count: importStats.total,
                    })}
                  </span>
                  <span className="text-green-600 dark:text-green-400">
                    {t("roleAssignments.importStatsValid", {
                      defaultValue: "Valid: {{count}}",
                      count: importStats.valid,
                    })}
                  </span>
                  <span className="text-destructive">
                    {t("roleAssignments.importStatsInvalid", {
                      defaultValue: "Errors: {{count}}",
                      count: importStats.invalid,
                    })}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400">
                    {t("roleAssignments.importStatsWarnings", {
                      defaultValue: "Warnings: {{count}}",
                      count: importStats.warnings,
                    })}
                  </span>
                </div>
                {previewErrorRows.length > 0 ? (
                  <div className="space-y-1 text-xs text-destructive">
                    <p className="font-medium">
                      {t("roleAssignments.importErrorPreview", {
                        defaultValue: "Rows with errors (showing up to 5):",
                      })}
                    </p>
                    {previewErrorRows.map((row) => (
                      <p key={`error-row-${row.rowNumber}`}>
                        {t("roleAssignments.importRowLabel", {
                          defaultValue: "Row {{row}}",
                          row: row.rowNumber,
                        })}
                        : {row.errors.join("; ")}
                      </p>
                    ))}
                  </div>
                ) : null}
                {previewWarningRows.length > 0 ? (
                  <div className="space-y-1 text-xs text-amber-600 dark:text-amber-400">
                    <p className="font-medium">
                      {t("roleAssignments.importWarningPreview", {
                        defaultValue: "Rows with warnings (showing up to 5):",
                      })}
                    </p>
                    {previewWarningRows.map((row) => (
                      <p key={`warning-row-${row.rowNumber}`}>
                        {t("roleAssignments.importRowLabel", {
                          defaultValue: "Row {{row}}",
                          row: row.rowNumber,
                        })}
                        : {row.warnings.join("; ")}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {activeImportJob ? (
              <div className="space-y-1 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-primary">
                <div className="flex items-center justify-between font-medium">
                  <span>
                    {t("roleAssignments.importActiveStatus", {
                      defaultValue: "Job status: {{status}}",
                      status: activeImportJob.status,
                    })}
                  </span>
                  <span>
                    {t("roleAssignments.importProgressLabel", {
                      defaultValue: "{{processed}} / {{total}} rows",
                      processed: activeImportJob.processedRows ?? 0,
                      total: activeImportJob.totalRows ?? importStats.total,
                    })}
                  </span>
                </div>
                {activeImportJob.message ? (
                  <div className="text-muted-foreground">{activeImportJob.message}</div>
                ) : null}
              </div>
            ) : null}
            {completedImportJob ? (
              <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-primary">
                <div className="font-medium">
                  {completedImportJob.message ??
                    t("roleAssignments.importCompletedSummary", {
                      defaultValue: "Processed {{processed}} rows. Successes: {{success}}. Failures: {{failure}}.",
                      processed: completedImportJob.processedRows ?? 0,
                      success: completedImportJob.successCount ?? 0,
                      failure: completedImportJob.failureCount ?? 0,
                    })}
                </div>
                <div className="text-muted-foreground">
                  {t("roleAssignments.importJobIdLabel", {
                    defaultValue: "Job ID: {{id}}",
                    id: completedImportJob.id,
                  })}
                </div>
                {completedImportJob.resultS3Key ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDownloadImportResult(completedImportJob)}
                  >
                    {t("roleAssignments.importDownloadResults", {
                      defaultValue: "Download result log",
                    })}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {importing && !activeImportJob ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t("roleAssignments.importingStatus", {
                  defaultValue: "Import started... validating rows and queuing the job.",
                })}
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground whitespace-pre-line">
              {activeImportJob
                ? activeImportJob.message ??
                  t("roleAssignments.importProgressLabel", {
                    defaultValue: "{{processed}} / {{total}} rows completed.",
                    processed: activeImportJob.processedRows ?? 0,
                    total: activeImportJob.totalRows ?? importStats.total,
                  })
                : completedImportJob
                ? t("roleAssignments.importModalCompletedHint", {
                    defaultValue: "Import finished. You can close this window.",
                  })
                : importStats.total > 0
                ? t("roleAssignments.importModalFooterReady", {
                    defaultValue: "Valid rows ready: {{valid}} of {{total}}.",
                    valid: importStats.valid,
                    total: importStats.total,
                  })
                : t("roleAssignments.importModalFooter", {
                    defaultValue: "Selected rows will overwrite existing accounts.",
                  })}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => handleImportModalOpenChange(false)} disabled={importing}>
                {t("roleAssignments.close", { defaultValue: "Close" })}
              </Button>
              <Button
                type="button"
                onClick={handleImportConfirm}
                disabled={
                  importing || !importFile || importStats.valid === 0 || importParseErrors.length > 0
                }
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    {t("roleAssignments.importing", { defaultValue: "Importing..." })}
                  </>
                ) : (
                  t("roleAssignments.startImport", { defaultValue: "Start import" })
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {bulkEditActive && bulkSelectionCount > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("roleAssignments.bulkCardTitle", { defaultValue: "Bulk account actions" })}</CardTitle>
            <CardDescription>
              {t("roleAssignments.bulkCardDescription", {
                defaultValue: "Apply role changes or delete {{count}} selected accounts.",
                count: bulkSelectionCount,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {bulkOperationInProgress ? (
              <div className="flex items-center gap-2 rounded-md border border-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {isBulkDeleting
                  ? t("roleAssignments.bulkDeletingStatus", {
                      defaultValue: "Deleting selected accounts…",
                    })
                  : t("roleAssignments.bulkUpdatingStatus", {
                      defaultValue: "Updating selected accounts…",
                    })}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {bulkSelectedEmails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
                >
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => handleBulkRemoveEmail(email)}
                    className="rounded-full p-0.5 transition hover:bg-primary/10"
                    aria-label={t("roleAssignments.bulkRemoveAccount", {
                      defaultValue: "Remove {{email}} from selection",
                      email,
                    })}
                  >
                    <X aria-hidden className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            {bulkError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {bulkError}
              </p>
            ) : null}
            {bulkResult && bulkFailureList.length ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <p className="font-medium">
                  {bulkResult.deletedCount !== undefined
                    ? t("roleAssignments.bulkDeleteFailureSummary", {
                        defaultValue: "Some accounts could not be deleted.",
                      })
                    : t("roleAssignments.bulkFailureSummary", {
                        defaultValue: "Some accounts could not be updated.",
                      })}
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {bulkFailureList.map((failure) => (
                    <li key={failure.primaryEmail}>
                      <span className="font-semibold">{failure.primaryEmail}</span>: {failure.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <form className="flex flex-col gap-4" onSubmit={onBulkSubmit}>
              <div className="grid gap-1">
                <Label>{t("roleAssignments.bulkActionLabel", { defaultValue: "Action" })}</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={bulkAction === "ADD" ? "default" : "outline"}
                    onClick={() => setBulkValue("action", "ADD", { shouldDirty: true })}
                    disabled={isBulkSubmitting || isBulkDeleting}
                  >
                    {t("roleAssignments.bulkActionAdd", { defaultValue: "Add roles" })}
                  </Button>
                  <Button
                    type="button"
                    variant={bulkAction === "REMOVE" ? "default" : "outline"}
                    onClick={() => setBulkValue("action", "REMOVE", { shouldDirty: true })}
                    disabled={isBulkSubmitting || isBulkDeleting}
                  >
                    {t("roleAssignments.bulkActionRemove", { defaultValue: "Remove roles" })}
                  </Button>
                </div>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="bulkRoles">{t("roleAssignments.bulkRoles", { defaultValue: "Roles to modify" })}</Label>
                <Controller
                  control={bulkControl}
                  name="roles"
                  render={({ field }) => (
                    <RoleSelector
                      id="bulkRoles"
                      value={field.value ?? []}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={isBulkSubmitting || isBulkDeleting}
                      placeholder={t("roleAssignments.bulkRolesPlaceholder", {
                        defaultValue: "Select roles to update...",
                      })}
                    />
                  )}
                />
                {bulkErrors.roles ? (
                  <p className="text-sm text-destructive">{bulkErrors.roles.message}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isBulkSubmitting || isBulkDeleting}>
                  {isBulkSubmitting
                    ? t("roleAssignments.bulkSubmitting", { defaultValue: "Applying..." })
                    : t("roleAssignments.bulkApply", { defaultValue: "Apply changes" })}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearBulkSelection}
                  disabled={isBulkSubmitting || isBulkDeleting}
                >
                  {t("roleAssignments.bulkCancel", { defaultValue: "Cancel bulk edit" })}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={isBulkSubmitting || isBulkDeleting || bulkSelectedEmails.length === 0}
                >
                  {isBulkDeleting
                    ? t("roleAssignments.bulkDeleting", { defaultValue: "Deleting..." })
                    : t("roleAssignments.bulkDeleteAction", { defaultValue: "Delete accounts" })}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("roleAssignments.bulkDeleteHint", {
                  defaultValue: "Deleting removes the selected entries from the account registry immediately.",
                })}
              </p>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>
            {editingEmail
              ? t("roleAssignments.editCardTitle", { defaultValue: "Update account" })
              : t("roleAssignments.createCardTitle", { defaultValue: "Create account" })}
          </CardTitle>
          <CardDescription>
            {t("roleAssignments.formHelp", {
              defaultValue: "Use the role selector to apply the Cognito roles available to staff.",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="grid gap-1">
              <Label htmlFor="primaryEmail">{t("roleAssignments.primaryEmail", { defaultValue: "Primary email" })}</Label>
              <Input
                id="primaryEmail"
                type="email"
                placeholder="user@kla.education"
                {...register("primaryEmail")}
                disabled={Boolean(editingEmail) || isSubmitting}
              />
              {errors.primaryEmail ? <p className="text-sm text-destructive">{errors.primaryEmail.message}</p> : null}
              {editingEmail ? (
                <p className="text-xs text-muted-foreground">
                  {t("roleAssignments.primaryEmailLocked", {
                    defaultValue: "Email is the identifier for this account and cannot be changed here.",
                  })}
                </p>
              ) : null}
            </div>

            <div className="grid gap-1">
              <Label htmlFor="roles">{t("roleAssignments.roles", { defaultValue: "Roles (token claims)" })}</Label>
              <Controller
                control={control}
                name="roles"
                render={({ field }) => (
                  <RoleSelector
                    id="roles"
                    value={field.value ?? []}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={isSubmitting}
                    placeholder={t("roleAssignments.rolesPlaceholder", {
                      defaultValue: "Select roles...",
                    })}
                  />
                )}
              />
              {errors.roles ? <p className="text-sm text-destructive">{errors.roles.message}</p> : null}
            </div>

            <div className="grid gap-1">
              <Label htmlFor="notes">{t("roleAssignments.notes", { defaultValue: "Notes" })}</Label>
              <Textarea id="notes" placeholder={t("roleAssignments.notesPlaceholder", { defaultValue: "Optional context for auditors" }) ?? ""} rows={3} {...register("notes")} />
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {editingEmail
                  ? t("roleAssignments.updateButton", { defaultValue: "Save changes" })
                  : t("roleAssignments.createButton", { defaultValue: "Save account" })}
              </Button>
              {editingEmail ? (
                <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSubmitting}>
                  {t("roleAssignments.cancelEdit", { defaultValue: "Cancel" })}
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("roleAssignments.tableTitle", { defaultValue: "Accounts registry" })}</CardTitle>
            <CardDescription>
              {t("roleAssignments.tableHelp", {
                defaultValue: "Tokens pick up updates on the next login. Remove an entry to revoke access.",
              })}
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAllAccounts(true)} disabled={loading}>
            {t("roleAssignments.viewAll", { defaultValue: "View all accounts" })}
          </Button>
        </CardHeader>
        <CardContent>
          {fetchError ? (
            <p className="text-sm text-destructive">{fetchError}</p>
          ) : recentAssignments.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              {t("roleAssignments.empty", { defaultValue: "No accounts yet. Use the form above to pre-provision access." })}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto" role={loading ? "status" : undefined} aria-live={loading ? "polite" : undefined}>
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("roleAssignments.tableEmail", { defaultValue: "Primary email" })}</th>
                      <th className="px-3 py-2 font-medium">{t("roleAssignments.tableRoles", { defaultValue: "Roles" })}</th>
                      <th className="px-3 py-2 font-medium">{t("roleAssignments.tableNotes", { defaultValue: "Notes" })}</th>
                      <th className="px-3 py-2 font-medium">{t("roleAssignments.tableUpdated", { defaultValue: "Last updated" })}</th>
                      <th className="px-3 py-2 font-medium">{t("roleAssignments.tableUpdatedBy", { defaultValue: "Updated by" })}</th>
                      <th className="px-3 py-2 font-medium sr-only">{t("roleAssignments.tableActions", { defaultValue: "Actions" })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading
                      ? tableSkeletonRows.map((_, index) => (
                          <tr key={`registry-skeleton-${index}`} className="bg-background/20">
                            <td className="px-3 py-4 align-top">
                              <Skeleton className="h-4 w-56 max-w-full" />
                              <Skeleton className="mt-2 h-3 w-32 max-w-full" />
                            </td>
                            <td className="px-3 py-4 align-top">
                              <div className="flex flex-wrap gap-1">
                                <Skeleton className="h-5 w-16 rounded-full" />
                                <Skeleton className="h-5 w-14 rounded-full" />
                                <Skeleton className="h-5 w-12 rounded-full" />
                              </div>
                            </td>
                            <td className="px-3 py-4 align-top">
                              <Skeleton className="h-3 w-40 max-w-full" />
                            </td>
                            <td className="px-3 py-4 align-top">
                              <Skeleton className="h-3 w-24 max-w-full" />
                            </td>
                            <td className="px-3 py-4 align-top">
                              <Skeleton className="h-3 w-28 max-w-full" />
                            </td>
                            <td className="px-3 py-4 align-top text-right">
                              <div className="flex justify-end gap-2">
                                <Skeleton className="h-8 w-20 rounded-md" />
                                <Skeleton className="h-8 w-20 rounded-md" />
                              </div>
                            </td>
                          </tr>
                        ))
                      : recentAssignments.map((assignment) => {
                          const lastUpdated = assignment.updatedAt ?? assignment.createdAt;
                          const updatedByEmail = assignment.updatedByEmail?.trim();
                          const updatedByDisplay =
                            updatedByEmail && updatedByEmail.length > 0 ? updatedByEmail : "-";
                          const isBulkSelected = bulkSelectionSet.has(assignment.primaryEmail);
                          return (
                            <tr
                              key={assignment.primaryEmail}
                              className={cn(
                                editingEmail === assignment.primaryEmail && "bg-primary/5",
                                isBulkSelected && "bg-primary/10"
                              )}
                            >
                              <td className="px-3 py-2 align-top font-medium">{assignment.primaryEmail}</td>
                              <td className="px-3 py-2 align-top">
                                <div className="flex flex-wrap gap-1">
                                  {normalizeList(assignment.roles).map((role) => (
                                    <span key={role} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                      {role}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                                {assignment.notes && assignment.notes.trim().length > 0 ? assignment.notes : "-"}
                              </td>
                              <td className="px-3 py-2 align-top text-xs text-muted-foreground">{formatDateTime(lastUpdated)}</td>
                              <td className="px-3 py-2 align-top text-xs text-muted-foreground">{updatedByDisplay}</td>
                              <td className="px-3 py-2 align-top text-right">
                                <div className="flex justify-end gap-2">
                                  <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(assignment)}>
                                    {t("roleAssignments.edit", { defaultValue: "Edit" })}
                                  </Button>
                                  <Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(assignment.primaryEmail)}>
                                    {t("roleAssignments.delete", { defaultValue: "Delete" })}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>
              {hasMoreRecords ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("roleAssignments.previewHint", {
                    defaultValue: "Showing the latest {{count}} accounts. Open the full list to see everything.",
                    count: RECENT_COUNT,
                  })}
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
      <Dialog open={showAllAccounts} onOpenChange={handleAllAccountsOpenChange}>
        <DialogContent
          className={cn(
            "w-full max-w-[min(95vw,72rem)] sm:max-w-[72rem]",
            "sm:h-[75vh] sm:max-h-[75vh] overflow-hidden",
            "grid-rows-[auto_minmax(0,1fr)_auto]"
          )}
        >
          <DialogHeader>
            <DialogTitle>{t("roleAssignments.modalTitle", { defaultValue: "All user accounts" })}</DialogTitle>
            <DialogDescription>
              {t("roleAssignments.modalDescription", {
                defaultValue: "Search and browse every account in the registry.",
              })}
            </DialogDescription>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {bulkSelectionCount > 0
                  ? t("roleAssignments.bulkSelectedCount", {
                      defaultValue: "{{count}} account(s) selected for bulk edit.",
                      count: bulkSelectionCount,
                    })
                  : t("roleAssignments.bulkSelectHint", {
                      defaultValue: "Enable selection to pick multiple accounts across searches.",
                    })}
              </p>
              <div className="flex items-center gap-2">
                {bulkSelecting ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={
                      isPageFullySelected ? handleBulkDeselectPage : handleBulkSelectAllOnPage
                    }
                    disabled={pageEmails.length === 0}
                  >
                    {isPageFullySelected
                      ? t("roleAssignments.bulkUnselectPage", { defaultValue: "Unselect page" })
                      : t("roleAssignments.bulkSelectAllPage", { defaultValue: "Select page" })}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant={bulkSelecting ? "secondary" : "outline"}
                  size="sm"
                  onClick={toggleBulkSelectMode}
                >
                  {bulkSelecting
                    ? t("roleAssignments.bulkSelectDone", { defaultValue: "Done selecting" })
                    : t("roleAssignments.bulkSelectStart", { defaultValue: "Select multiple" })}
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex h-full flex-col gap-4 overflow-hidden">
            <form onSubmit={handleSearchSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="searchEmail">{t("roleAssignments.searchEmail", { defaultValue: "Filter by email" })}</Label>
                <Input
                  id="searchEmail"
                  value={searchEmailInput}
                  onChange={(event) => setSearchEmailInput(event.target.value)}
                  placeholder="user@kla.education"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="searchRole">{t("roleAssignments.searchRole", { defaultValue: "Filter by role" })}</Label>
                <Input
                  id="searchRole"
                  value={searchRoleInput}
                  onChange={(event) => setSearchRoleInput(event.target.value)}
                  placeholder="Admin"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={allLoading}>
                  {t("roleAssignments.applyFilters", { defaultValue: "Apply filters" })}
                </Button>
                <Button type="button" variant="outline" onClick={handleClearFilters} disabled={allLoading}>
                  {t("roleAssignments.clearFilters", { defaultValue: "Clear" })}
                </Button>
              </div>
            </form>

            <div className="min-h-[320px] flex-1 overflow-auto sm:min-h-[55vh]">
              {allAccounts.length === 0 && !allLoading ? (
                <p className="text-sm text-muted-foreground">
                  {t("roleAssignments.noResults", { defaultValue: "No accounts found." })}
                </p>
              ) : (
                <>
                  {allLoading && allAccounts.length > 0 ? (
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      {t("roleAssignments.loading", { defaultValue: "Loading accounts..." })}
                    </div>
                  ) : null}
                  <div
                    className="overflow-x-auto"
                    role={allLoading ? "status" : undefined}
                    aria-live={allLoading ? "polite" : undefined}
                  >
                    <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {bulkSelecting ? (
                        <th className="px-3 py-2 font-medium">
                          <span className="sr-only">
                            {t("roleAssignments.bulkSelectColumn", { defaultValue: "Select" })}
                          </span>
                        </th>
                      ) : null}
                      <th className="px-3 py-2 font-medium">{t("roleAssignments.tableEmail", { defaultValue: "Primary email" })}</th>
                      <th className="px-3 py-2 font-medium">{t("roleAssignments.tableRoles", { defaultValue: "Roles" })}</th>
                      <th className="px-3 py-2 font-medium">{t("roleAssignments.tableNotes", { defaultValue: "Notes" })}</th>
                      <th className="px-3 py-2 font-medium">{t("roleAssignments.tableUpdated", { defaultValue: "Last updated" })}</th>
                      <th className="px-3 py-2 font-medium">{t("roleAssignments.tableUpdatedBy", { defaultValue: "Updated by" })}</th>
                      <th className="px-3 py-2 font-medium sr-only">{t("roleAssignments.tableActions", { defaultValue: "Actions" })}</th>
                    </tr>
                  </thead>
                    <tbody className="divide-y divide-border">
                    {allLoading && allAccounts.length === 0
                      ? modalSkeletonRows.map((_, index) => (
                          <tr key={`all-accounts-skeleton-${index}`} className="bg-background/20">
                            {bulkSelecting ? (
                              <td className="px-3 py-3 align-middle">
                                <div className="flex justify-center">
                                  <Skeleton className="h-5 w-5 rounded" />
                                </div>
                              </td>
                            ) : null}
                            <td className="px-3 py-3 align-top">
                              <Skeleton className="h-4 w-56 max-w-full" />
                              <Skeleton className="mt-2 h-3 w-32 max-w-full" />
                            </td>
                            <td className="px-3 py-3 align-top">
                              <div className="flex flex-wrap gap-1">
                                <Skeleton className="h-5 w-16 rounded-full" />
                                <Skeleton className="h-5 w-14 rounded-full" />
                                <Skeleton className="h-5 w-12 rounded-full" />
                              </div>
                            </td>
                            <td className="px-3 py-3 align-top">
                              <Skeleton className="h-3 w-40 max-w-full" />
                            </td>
                            <td className="px-3 py-3 align-top">
                              <Skeleton className="h-3 w-28 max-w-full" />
                            </td>
                            <td className="px-3 py-3 align-top">
                              <Skeleton className="h-3 w-28 max-w-full" />
                            </td>
                            <td className="px-3 py-3 align-top text-right">
                              <div className="flex justify-end gap-2">
                                <Skeleton className="h-8 w-20 rounded-md" />
                                <Skeleton className="h-8 w-20 rounded-md" />
                              </div>
                            </td>
                          </tr>
                        ))
                      : allAccounts.map((assignment, index) => {
                      const lastUpdated = assignment.updatedAt ?? assignment.createdAt;
                      const updatedByEmail = assignment.updatedByEmail?.trim();
                      const updatedByDisplay =
                        updatedByEmail && updatedByEmail.length > 0 ? updatedByEmail : "-";
                      const isBulkSelected = bulkSelectionSet.has(assignment.primaryEmail);
                      return (
                        <tr
                          key={`${assignment.primaryEmail}-${assignment.updatedAt ?? assignment.createdAt}`}
                          className={cn(
                            editingEmail === assignment.primaryEmail && "bg-primary/5",
                            isBulkSelected && "bg-primary/10"
                          )}
                        >
                          {bulkSelecting ? (
                            <td className="px-3 py-2 align-top">
                              <input
                                type="checkbox"
                                className="h-5 w-5 rounded border-muted-foreground/40"
                                checked={isBulkSelected}
                                onChange={(event) => {
                                  const shiftKey = Boolean((event.nativeEvent as MouseEvent | KeyboardEvent).shiftKey);
                                  handleBulkCheckboxChange(
                                    assignment.primaryEmail,
                                    index,
                                    shiftKey,
                                    event.target.checked
                                  );
                                }}
                                aria-label={t("roleAssignments.bulkSelectAccount", {
                                  defaultValue: "Select {{email}}",
                                  email: assignment.primaryEmail,
                                })}
                              />
                            </td>
                          ) : null}
                          <td className="px-3 py-2 align-top font-medium">{assignment.primaryEmail}</td>
                          <td className="px-3 py-2 align-top">
                            <div className="flex flex-wrap gap-1">
                              {normalizeList(assignment.roles).map((role) => (
                                <span key={role} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                  {role}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                            {assignment.notes && assignment.notes.trim().length > 0 ? assignment.notes : "-"}
                          </td>
                          <td className="px-3 py-2 align-top text-xs text-muted-foreground">{formatDateTime(lastUpdated)}</td>
                          <td className="px-3 py-2 align-top text-xs text-muted-foreground">{updatedByDisplay}</td>
                          <td className="px-3 py-2 align-top text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  handleAllAccountsOpenChange(false);
                                  handleEdit(assignment);
                                }}
                              >
                                {t("roleAssignments.edit", { defaultValue: "Edit" })}
                              </Button>
                              <Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(assignment.primaryEmail)}>
                                {t("roleAssignments.delete", { defaultValue: "Delete" })}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span>
                {t("roleAssignments.tablePageInfo", { defaultValue: "Page {{page}}", page: allPageNumber })}
              </span>
              {bulkSelectionCount > 0 ? (
                <span>
                  {t("roleAssignments.bulkSelectedCountShort", {
                    defaultValue: "{{count}} selected",
                    count: bulkSelectionCount,
                  })}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => handleAllAccountsOpenChange(false)}>
                {t("roleAssignments.close", { defaultValue: "Close" })}
              </Button>
              <Button type="button" variant="outline" onClick={handlePreviousPage} disabled={allLoading || allPrevTokens.length === 0}>
                {t("roleAssignments.previousPage", { defaultValue: "Previous" })}
              </Button>
              <Button type="button" onClick={handleNextPage} disabled={allLoading || !allNextToken}>
                {t("roleAssignments.nextPage", { defaultValue: "Next" })}
              </Button>
              {bulkSelecting ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearBulkSelection}
                    disabled={bulkSelectionCount === 0}
                  >
                    {t("roleAssignments.bulkClearSelection", { defaultValue: "Clear selection" })}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleBulkContinue}
                    disabled={bulkSelectionCount < 2}
                  >
                    {t("roleAssignments.bulkContinue", {
                      defaultValue: "Continue ({{count}})",
                      count: bulkSelectionCount,
                    })}
                  </Button>
                </>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

