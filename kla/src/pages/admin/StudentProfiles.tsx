import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  FileDown,
  Filter,
  Info,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRoundPen,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { generateClient } from "aws-amplify/data";
import { getUrl } from "aws-amplify/storage";

import type { Schema } from "../../../amplify/data/resource";
import {
  ProfileLifecycleStatus,
  UserType,
  buildAdminUpsertUserProfileInput,
  studentUserProfileFormSchema,
  type StudentUserProfileFormValues,
} from "../../../shared/userProfiles";
import {
  STUDENT_PROFILE_CSV_HEADERS,
  parseStudentProfileCsv,
  type StudentProfileImportRow,
} from "../../../shared/studentProfileImport";
import { deriveStudentGradeFromEmail } from "../../../shared/studentGrade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { readCsvFileContents } from "@/lib/csvEncoding";

const client = generateClient<Schema>();

type UserProfileItem = Schema["UserProfileListItem"]["type"];
type ListResponse = Schema["UserProfileListResult"]["type"];
type UserProfile = Schema["UserProfile"]["type"];
type StudentProfileImportJob = Schema["StudentProfileImportJob"]["type"];

const PAGE_SIZE = 12;
const USER_PROFILE_SK = "PROFILE";

type AdvancedFilterInputs = {
  name: string;
  email: string;
  grade: string;
  dateOfBirthFrom: string;
  dateOfBirthTo: string;
  updatedFrom: string;
  updatedTo: string;
};

type AppliedAdvancedFilters = {
  name?: string;
  email?: string;
  grade?: number;
  dateOfBirthFrom?: string;
  dateOfBirthTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
};

type LoadOptions = {
  page?: number;
  invalidateTokens?: boolean;
};

const defaultStudentFormValues: StudentUserProfileFormValues = {
  userId: "",
  userType: UserType.STUDENT,
  status: ProfileLifecycleStatus.ACTIVE,
  displayName: "",
  legalName: "",
  preferredName: "",
  primaryEmail: "",
  secondaryEmails: [],
  phoneNumbers: [],
  tags: [],
  notes: "",
  student: {
    fullName: "",
    dateOfBirth: "",
    motherName: "",
    motherEmail: "",
    motherPhone: "",
    motherProfession: "",
    fatherName: "",
    fatherEmail: "",
    fatherPhone: "",
    fatherProfession: "",
    healthNotes: "",
    receivesSocialAssistance: null,
    livesWithBothParents: null,
    livesWithParentsDetails: "",
    comments: "",
    homeAddress: "",
    homeCity: "",
  },
};

const defaultAdvancedFilterInputs: AdvancedFilterInputs = {
  name: "",
  email: "",
  grade: "",
  dateOfBirthFrom: "",
  dateOfBirthTo: "",
  updatedFrom: "",
  updatedTo: "",
};

function mapProfileToListItem(profile: UserProfile): UserProfileItem {
  return {
    pk: profile.pk,
    sk: profile.sk,
    userId: profile.userId,
    userType: profile.userType,
    status: profile.status,
    displayName: profile.displayName ?? undefined,
    legalName: profile.legalName ?? undefined,
    preferredName: profile.preferredName ?? undefined,
    primaryEmail: profile.primaryEmail ?? undefined,
    primaryEmailLower: profile.primaryEmailLower ?? undefined,
    secondaryEmails: profile.secondaryEmails ?? [],
    phoneNumbers: profile.phoneNumbers ?? [],
    student: profile.student ?? undefined,
    studentGrade: profile.studentGrade ?? undefined,
    tags: profile.tags ?? [],
    notes: profile.notes ?? undefined,
    archivedAt: profile.archivedAt ?? undefined,
    deactivatedAt: profile.deactivatedAt ?? undefined,
    completedAt: profile.completedAt ?? undefined,
    lastReviewedAt: profile.lastReviewedAt ?? undefined,
    updatedBySub: profile.updatedBySub ?? undefined,
    updatedByEmail: profile.updatedByEmail ?? undefined,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function studentValuesFromItem(item: UserProfileItem): StudentUserProfileFormValues {
  const student = (item.student ?? {}) as Partial<NonNullable<UserProfileItem["student"]>>;
  const secondaryEmails = (item.secondaryEmails ?? []).filter(
    (email): email is string => typeof email === "string" && email.length > 0
  );
  const phoneNumbers = (item.phoneNumbers ?? []).filter(
    (phone): phone is string => typeof phone === "string" && phone.length > 0
  );
  const tags = (item.tags ?? []).filter(
    (tag): tag is string => typeof tag === "string" && tag.length > 0
  );
  return {
    userId: item.userId,
    userType: UserType.STUDENT,
    status: (item.status ?? ProfileLifecycleStatus.ACTIVE) as ProfileLifecycleStatus,
    displayName: item.displayName ?? "",
    legalName: item.legalName ?? "",
    preferredName: item.preferredName ?? "",
    primaryEmail: item.primaryEmail ?? "",
    secondaryEmails,
    phoneNumbers,
    tags,
    notes: item.notes ?? "",
    student: {
      fullName: student.fullName ?? "",
      dateOfBirth: student.dateOfBirth ?? "",
      motherName: student.motherName ?? "",
      motherEmail: student.motherEmail ?? "",
      motherPhone: student.motherPhone ?? "",
      motherProfession: student.motherProfession ?? "",
      fatherName: student.fatherName ?? "",
      fatherEmail: student.fatherEmail ?? "",
      fatherPhone: student.fatherPhone ?? "",
      fatherProfession: student.fatherProfession ?? "",
      healthNotes: student.healthNotes ?? "",
      receivesSocialAssistance:
        typeof student.receivesSocialAssistance === "boolean" ? student.receivesSocialAssistance : null,
      livesWithBothParents:
        typeof student.livesWithBothParents === "boolean" ? student.livesWithBothParents : null,
      livesWithParentsDetails:
        student.livesWithParentsDetails ??
        (student.livesWithBothParents === false && student.comments ? student.comments : ""),
      comments: student.comments ?? "",
      homeAddress: student.homeAddress ?? "",
      homeCity: student.homeCity ?? "",
    },
  };
}

function resolveStudentGrade(item: UserProfileItem): number | null {
  return (
    item.studentGrade ??
    deriveStudentGradeFromEmail(item.primaryEmail ?? item.primaryEmailLower ?? undefined)
  );
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.length > 0) return error;
  return fallback;
}

export default function StudentProfilesPage() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<UserProfileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProfileLifecycleStatus | "ALL">("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [filterInputs, setFilterInputs] = useState<AdvancedFilterInputs>(() => ({ ...defaultAdvancedFilterInputs }));
  const [appliedFilters, setAppliedFilters] = useState<AppliedAdvancedFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UserProfileItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<StudentProfileImportRow[]>([]);
  const [importParseErrors, setImportParseErrors] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [activeImportJobId, setActiveImportJobId] = useState<string | null>(null);
  const [activeImportJob, setActiveImportJob] = useState<StudentProfileImportJob | null>(null);
  const [completedImportJob, setCompletedImportJob] = useState<StudentProfileImportJob | null>(null);
  const [importFileContents, setImportFileContents] = useState<string>("");
  const previousProfilesRef = useRef<UserProfileItem[] | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const pageTokensRef = useRef<Array<string | null>>([null]);
  const [profileToDelete, setProfileToDelete] = useState<UserProfileItem | null>(null);
  const [deletingProfile, setDeletingProfile] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StudentUserProfileFormValues>({
    resolver: zodResolver(studentUserProfileFormSchema) as Resolver<StudentUserProfileFormValues>,
    defaultValues: defaultStudentFormValues,
  });

  const livesWithBothParents = watch("student.livesWithBothParents");
  const livesWithParentsDetails = watch("student.livesWithParentsDetails");
  const primaryEmailValue = watch("primaryEmail");
  const livesWithParentsDetailsText = (livesWithParentsDetails ?? "").trim();
  const showLivesWithParentsDetails = livesWithBothParents === false;

  const editingItemGrade = useMemo(() => (editingItem ? resolveStudentGrade(editingItem) : null), [editingItem]);

  const derivedGradeFromEmail = useMemo(
    () => deriveStudentGradeFromEmail(primaryEmailValue ?? editingItem?.primaryEmail ?? undefined),
    [primaryEmailValue, editingItem?.primaryEmail]
  );
  const activeStudentGrade = derivedGradeFromEmail ?? editingItemGrade ?? null;
  const formatStudentGradeLabel = useCallback(
    (grade: number | null | undefined) => {
      if (grade == null) {
        return null;
      }
      if (grade === 0) {
        return t("studentProfiles.kindergartenValue", { defaultValue: "Kindergarten" });
      }
      return t("studentProfiles.gradeValue", {
        defaultValue: "Grade {{grade}}",
        grade,
      });
    },
    [t]
  );
  const activeStudentGradeLabel = useMemo(
    () => formatStudentGradeLabel(activeStudentGrade),
    [activeStudentGrade, formatStudentGradeLabel]
  );

  useEffect(() => {
    if (!showLivesWithParentsDetails) {
      setValue("student.livesWithParentsDetails", "");
    }
  }, [setValue, showLivesWithParentsDetails]);

  const importStats = useMemo(() => {
    const total = importPreview.length;
    const invalid = importPreview.filter((row) => row.errors.length > 0 || !row.profile).length;
    const valid = total - invalid;
    return { total, valid, invalid };
  }, [importPreview]);

  const previewErrors = useMemo(
    () => importPreview.filter((row) => row.errors.length > 0 || !row.profile),
    [importPreview]
  );

  const previewReady = useMemo(
    () => importPreview.filter((row) => row.errors.length === 0 && row.profile),
    [importPreview]
  );

  const pageSummaryText = useMemo(() => {
    if (profiles.length === 0) {
      return t("studentProfiles.noResultsShort", { defaultValue: "No student profiles found." });
    }
    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = start + profiles.length - 1;
    return t("studentProfiles.rangeLabel", {
      defaultValue: "Showing {{from}}-{{to}} student records",
      from: start,
      to: end,
    });
  }, [currentPage, profiles.length, t]);

  const advancedFiltersActive = useMemo(
    () =>
      Object.values(appliedFilters).some(
        (value) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)
      ),
    [appliedFilters]
  );

  const advancedFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (appliedFilters.name) {
      chips.push(
        t("studentProfiles.filters.name", {
          defaultValue: `Name contains "${appliedFilters.name}"`,
          value: appliedFilters.name,
        })
      );
    }
    if (appliedFilters.email) {
      chips.push(
        t("studentProfiles.filters.email", {
          defaultValue: `Email equals ${appliedFilters.email}`,
          value: appliedFilters.email,
        })
      );
    }
    if (typeof appliedFilters.grade === "number") {
      const label =
        appliedFilters.grade === 0
          ? t("studentProfiles.kindergartenValue", { defaultValue: "Kindergarten" })
          : t("studentProfiles.gradeValue", { defaultValue: "Grade {{grade}}", grade: appliedFilters.grade });
      chips.push(
        t("studentProfiles.filters.grade", {
          defaultValue: "Grade: {{grade}}",
          grade: label,
        })
      );
    }
    if (appliedFilters.dateOfBirthFrom || appliedFilters.dateOfBirthTo) {
      chips.push(
        t("studentProfiles.filters.dob", {
          defaultValue: "DOB {{from}} - {{to}}",
          from: appliedFilters.dateOfBirthFrom ?? "…",
          to: appliedFilters.dateOfBirthTo ?? "…",
        })
      );
    }
    if (appliedFilters.updatedFrom || appliedFilters.updatedTo) {
      chips.push(
        t("studentProfiles.filters.updated", {
          defaultValue: "Updated {{from}} - {{to}}",
          from: appliedFilters.updatedFrom ? appliedFilters.updatedFrom.slice(0, 10) : "…",
          to: appliedFilters.updatedTo ? appliedFilters.updatedTo.slice(0, 10) : "…",
        })
      );
    }
    return chips;
  }, [appliedFilters, t]);

  const gradeOptions = useMemo(() => Array.from({ length: 13 }, (_, grade) => grade), []);

  const filtersDirty = useMemo(() => {
    const hasFilterInputs = Object.values(filterInputs).some((value) => value.trim().length > 0);
    return searchInput.trim().length > 0 || statusFilter !== "ALL" || advancedFiltersActive || hasFilterInputs;
  }, [advancedFiltersActive, filterInputs, searchInput, statusFilter]);

  const loadProfiles = useCallback(
    async ({ page = 1, invalidateTokens = false }: LoadOptions = {}) => {
      try {
        if (invalidateTokens) {
          pageTokensRef.current = [null];
          setHasNextPage(false);
          setCurrentPage(1);
        }
        const tokens = pageTokensRef.current;
        const token = tokens[page - 1] ?? null;

        if (invalidateTokens || page === 1) {
          setFetchError(null);
          setStatusMessage(null);
        }

        setLoading(true);

        const response = await client.queries.adminListUserProfiles(
          {
            userType: UserType.STUDENT,
            status: statusFilter === "ALL" ? undefined : statusFilter,
            search: searchQuery || undefined,
            nameContains: appliedFilters.name,
            email: appliedFilters.email,
            grade: typeof appliedFilters.grade === "number" ? appliedFilters.grade : undefined,
            dateOfBirthFrom: appliedFilters.dateOfBirthFrom,
            dateOfBirthTo: appliedFilters.dateOfBirthTo,
            updatedFrom: appliedFilters.updatedFrom,
            updatedTo: appliedFilters.updatedTo,
            limit: PAGE_SIZE,
            nextToken: token ?? undefined,
          },
          { authMode: "userPool" }
        );

        if (response.errors?.length) {
          throw new Error(response.errors.map((error) => error.message).join(", "));
        }

        const data = (response.data ?? null) as ListResponse | null;
        const items = (data?.items ?? []).filter(
          (item): item is UserProfileItem => item !== null && item !== undefined
        );

        setProfiles(items);

        const upcomingToken = data?.nextToken ?? null;
        tokens[page] = upcomingToken;
        setHasNextPage(Boolean(upcomingToken));
        setCurrentPage(page);
      } catch (error) {
        console.error("Failed to load student profiles", error);
        setFetchError(
          error instanceof Error
            ? error.message
            : t("studentProfiles.errorLoad", { defaultValue: "Failed to load student data." })
        );
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters, searchQuery, statusFilter, t]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (page < 1 || (page === currentPage && profiles.length > 0)) return;
      const tokens = pageTokensRef.current;
      if (page > 1 && typeof tokens[page - 1] === "undefined") {
        return;
      }
      void loadProfiles({ page });
    },
    [currentPage, loadProfiles, profiles.length]
  );

  useEffect(() => {
    void loadProfiles({ page: 1, invalidateTokens: true });
  }, [loadProfiles]);

  const handleSearchSubmit = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      const trimmed = searchInput.trim();
      const normalizedFilters = normalizeAdvancedFilters(filterInputs);
      const filtersChanged = !areAdvancedFiltersEqual(appliedFilters, normalizedFilters);
      if (trimmed === searchQuery && !filtersChanged) {
        void loadProfiles({ page: 1, invalidateTokens: true });
        return;
      }
      setAppliedFilters(normalizedFilters);
      setSearchQuery(trimmed);
    },
    [appliedFilters, filterInputs, loadProfiles, searchInput, searchQuery]
  );

  useEffect(() => {
    if (!activeImportJobId) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const response = await client.models.StudentProfileImportJob.get(
          { id: activeImportJobId },
          { authMode: "userPool" }
        );
        if (cancelled) return;
        if (response.errors?.length) {
          throw new Error(response.errors.map((error: { message?: string }) => error.message).join(", "));
        }
        const job = (response.data ?? null) as StudentProfileImportJob | null;
        if (!job) {
          throw new Error("Import job not found.");
        }
        if (job.status === "SUCCEEDED" || job.status === "FAILED") {
          setCompletedImportJob(job);
          setImporting(false);
          setActiveImportJobId(null);
          setActiveImportJob(null);
          setStatusMessage(job.message ?? null);
          await loadProfiles({ page: 1, invalidateTokens: true });
          return;
        }
        setActiveImportJob(job);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to poll student import job", error);
          setImportError(
            toErrorMessage(
              error,
              t("studentProfiles.import.errorGeneric", { defaultValue: "Failed to monitor import progress." })
            )
          );
          setImporting(false);
          setActiveImportJobId(null);
        }
        return;
      }

      if (!cancelled) {
        timeoutId = setTimeout(poll, 2000);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeImportJobId, loadProfiles, t]);

  const resetImportState = useCallback(() => {
    setImportFile(null);
    setImportPreview([]);
    setImportParseErrors([]);
    setImportError(null);
    setImporting(false);
    setActiveImportJobId(null);
    setActiveImportJob(null);
    setCompletedImportJob(null);
    setImportFileContents("");
    if (importFileInputRef.current) {
      importFileInputRef.current.value = "";
    }
  }, []);

  const handleImportClick = useCallback(() => {
    resetImportState();
    setShowImportModal(true);
  }, [resetImportState]);

  const handleImportModalOpenChange = useCallback(
    (open: boolean) => {
      if (!open && importing) return;
      setShowImportModal(open);
      if (!open) {
        resetImportState();
      }
    },
    [importing, resetImportState]
  );

  const handleImportFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      setImportFile(file);
      setImportError(null);
    setImportParseErrors([]);
    setCompletedImportJob(null);
    setActiveImportJob(null);
    setActiveImportJobId(null);
    setImportFileContents("");

    if (!file) {
      setImportPreview([]);
      return;
      }

      void readCsvFileContents(file)
        .then(({ text }) => {
          if (!text.trim()) {
            setImportPreview([]);
            setImportParseErrors([
              t("studentProfiles.import.errors.emptyFile", { defaultValue: "The selected CSV file is empty." }),
            ]);
            setImportFileContents("");
            return;
          }
          setImportFileContents(text);
          const parsed = parseStudentProfileCsv(text);
          setImportPreview(parsed.rows);
          setImportParseErrors(parsed.errors);
        })
        .catch((error: unknown) => {
          console.error("Failed to read import CSV", error);
          setImportPreview([]);
          setImportParseErrors([]);
          setImportError(
            toErrorMessage(
              error,
              t("studentProfiles.import.errors.readFailed", { defaultValue: "Could not read the CSV file." })
            )
          );
          setImportFileContents("");
        });
    },
    [t]
  );

  const encodeCsvValue = useCallback((value: string) => {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    const encodeRow = (data: Record<string, string | undefined>) =>
      STUDENT_PROFILE_CSV_HEADERS.map((header) => encodeCsvValue(data[header] ?? "")).join(",");

    const rowOne = encodeRow({
      primaryEmail: "student.one@kla.education",
      status: "ACTIVE",
      "student.firstName": "Student",
      "student.lastName": "One",
      "student.dateOfBirth": "12/05/2008",
      "student.motherName": "Jane One",
      "student.motherEmail": "jane.one@example.com",
      "student.motherPhone": "+38344111222",
      "student.motherProfession": "Engineer",
      "student.fatherName": "John One",
      "student.fatherEmail": "john.one@example.com",
      "student.fatherPhone": "+38344111333",
      "student.fatherProfession": "Architect",
      "student.healthNotes": "Peanut allergy",
      "student.receivesSocialAssistance": "No",
      "student.livesWithBothParents": "Yes",
      "student.comments": "Excellent progress in math.",
      "student.homeAddress": "123 Main Street",
      "student.homeCity": "Pristina",
    });

    const rowTwo = encodeRow({
      primaryEmail: "student.two@kla.education",
      status: "ACTIVE",
      "student.firstName": "Student",
      "student.lastName": "Two",
      "student.homeCity": "Mitrovica",
    });

    const csv = [STUDENT_PROFILE_CSV_HEADERS.join(","), rowOne, rowTwo].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-profiles-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [encodeCsvValue]);

  const handleDownloadImportResult = useCallback(
    async (job: StudentProfileImportJob) => {
      if (!job.resultS3Key) return;
      try {
        const { url } = await getUrl({
          path: job.resultS3Key,
          options: { expiresIn: 300 },
        });
        window.open(url.href, "_blank", "noopener,noreferrer");
      } catch (error) {
        console.error("Failed to download student import results", error);
        setImportError(
          toErrorMessage(
            error,
            t("studentProfiles.import.downloadError", { defaultValue: "Failed to download import results." })
          )
        );
      }
    },
    [t]
  );
  const handleImportConfirm = useCallback(async () => {
    if (!importFile) {
      setImportError(t("studentProfiles.import.errors.noRows", { defaultValue: "Select a CSV file to continue." }));
      return;
    }

    if (importPreview.length === 0) {
      setImportError(
        t("studentProfiles.import.errors.noRows", { defaultValue: "Select a CSV file to continue." })
      );
      return;
    }

    if (importStats.valid === 0) {
      setImportError(
        t("studentProfiles.import.errors.resolveIssues", {
          defaultValue: "Resolve the highlighted rows before importing.",
        })
      );
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
        throw new Error(
          t("studentProfiles.import.errors.emptyFile", { defaultValue: "The selected CSV file is empty." })
        );
      }

      const response = await client.mutations.adminStartStudentProfileImport(
        {
          csv: csvText,
          fileName: importFile.name,
        },
        { authMode: "userPool" }
      );

      if (response.errors?.length) {
        throw new Error(response.errors.map((error) => error.message).join(", "));
      }

      const job = (response.data ?? null) as StudentProfileImportJob | null;
      if (!job) {
        throw new Error(
          t("studentProfiles.import.errorGeneric", { defaultValue: "Failed to start student profile import." })
        );
      }

      setActiveImportJobId(job.id);
      setActiveImportJob(job);
      setStatusMessage(
        t("studentProfiles.import.jobQueued", {
          defaultValue: "Import queued. Job ID: {{id}}",
          id: job.id,
        })
      );
    } catch (error) {
      console.error("Failed to queue student profile import", error);
      setImportError(
        toErrorMessage(
          error,
          t("studentProfiles.import.errorGeneric", { defaultValue: "Failed to import student profiles." })
        )
      );
      setStatusMessage(null);
      setImporting(false);
    }
  }, [importFile, importFileContents, importPreview.length, importStats.valid, t]);

  const openCreateModal = useCallback(() => {
    setEditingItem(null);
    reset(defaultStudentFormValues);
    setFormError(null);
    setIsModalOpen(true);
  }, [reset]);

  const openEditModal = useCallback(
    (item: UserProfileItem) => {
      setEditingItem(item);
      reset(studentValuesFromItem(item));
      setFormError(null);
      setIsModalOpen(true);
    },
    [reset]
  );

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingItem(null);
    reset(defaultStudentFormValues);
    setFormError(null);
  }, [reset]);

  const handleRequestDelete = useCallback((profile: UserProfileItem) => {
    setProfileToDelete(profile);
    setStatusMessage(null);
  }, []);

  const handleDeleteDialogChange = useCallback((open: boolean) => {
    if (!open && !deletingProfile) {
      setProfileToDelete(null);
    }
  }, [deletingProfile]);

  const handleConfirmDelete = useCallback(async () => {
    if (!profileToDelete) return;
    setDeletingProfile(true);
    try {
      const result = await client.mutations.adminDeleteUserProfile(
        { userId: profileToDelete.userId },
        { authMode: "userPool" }
      );
      if (result.errors?.length) {
        throw new Error(result.errors.map((error) => error.message).join(", "));
      }
      setProfiles((prev) => prev.filter((item) => item.pk !== profileToDelete.pk));
      setStatusMessage(
        t("studentProfiles.deleteSuccess", { defaultValue: "Student profile deleted." })
      );
      setProfileToDelete(null);
    } catch (error) {
      console.error("Failed to delete student profile", error);
      setStatusMessage(
        toErrorMessage(
          error,
          t("studentProfiles.deleteError", { defaultValue: "Failed to delete student profile." })
        )
      );
    } finally {
      setDeletingProfile(false);
    }
  }, [client.mutations, profileToDelete, t]);

  const onSubmit = handleSubmit(async (values: StudentUserProfileFormValues) => {
    setSaving(true);
    setFormError(null);
    previousProfilesRef.current = profiles;
    const isEditing = Boolean(editingItem);

    const normalizedValues: StudentUserProfileFormValues = {
      ...values,
      userId: values.userId.trim(),
      userType: UserType.STUDENT,
      student: {
        ...values.student,
        fullName: values.student.fullName.trim(),
      },
    };

    const input = buildAdminUpsertUserProfileInput(normalizedValues, {
      status: values.status,
    });

    const optimisticItem: UserProfileItem = {
      pk: `USER#${input.userId}`,
      sk: USER_PROFILE_SK,
      userId: input.userId,
      userType: input.userType,
      status: input.status ?? ProfileLifecycleStatus.ACTIVE,
      displayName: input.displayName ?? undefined,
      legalName: input.legalName ?? undefined,
      preferredName: input.preferredName ?? undefined,
      primaryEmail: input.primaryEmail ?? undefined,
      primaryEmailLower: input.primaryEmail?.toLowerCase() ?? undefined,
      secondaryEmails: input.secondaryEmails ?? [],
      phoneNumbers: input.phoneNumbers ?? [],
      student: input.student ?? undefined,
      studentGrade: deriveStudentGradeFromEmail(input.primaryEmail ?? undefined) ?? undefined,
      tags: input.tags ?? [],
      notes: input.notes ?? undefined,
      archivedAt: input.archivedAt ?? undefined,
      deactivatedAt: input.deactivatedAt ?? undefined,
      completedAt: input.completedAt ?? undefined,
      lastReviewedAt: input.lastReviewedAt ?? undefined,
      updatedBySub: undefined,
      updatedByEmail: undefined,
      createdAt: editingItem?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProfiles((prev) => {
      const exists = prev.some((item) => item.pk === optimisticItem.pk);
      if (exists) {
        return prev.map((item) => (item.pk === optimisticItem.pk ? optimisticItem : item));
      }
      return [optimisticItem, ...prev];
    });

    try {
      const result = await client.mutations.adminUpsertUserProfile(input, { authMode: "userPool" });
      if (result.errors?.length) {
        throw new Error(result.errors.map((error) => error.message).join(", "));
      }

      const profile = (result.data ?? null) as UserProfile | null;
      if (!profile) {
        throw new Error(
          t("studentProfiles.errorNoProfile", {
            defaultValue: "The server did not return the saved profile.",
          })
        );
      }

      const mappedItem = mapProfileToListItem(profile);
      setProfiles((prev) => prev.map((item) => (item.pk === mappedItem.pk ? mappedItem : item)));
      setStatusMessage(
        isEditing
          ? t("studentProfiles.updatedMessage", { defaultValue: "Student profile updated." })
          : t("studentProfiles.createdMessage", { defaultValue: "Student profile created." })
      );
      closeModal();
    } catch (error) {
      console.error("Failed to save student profile", error);
      if (previousProfilesRef.current) {
        setProfiles(previousProfilesRef.current);
      }
      setStatusMessage(null);
      setFormError(
        error instanceof Error
          ? error.message
          : t("studentProfiles.errorSave", { defaultValue: "Failed to save student profile." })
      );
    } finally {
      setSaving(false);
    }
  });


  const statusOptions = useMemo(
    () => [
      { value: "ALL", label: t("studentProfiles.status.all", { defaultValue: "All statuses" }) },
      { value: ProfileLifecycleStatus.ACTIVE, label: t("studentProfiles.status.active", { defaultValue: "Active" }) },
      { value: ProfileLifecycleStatus.DRAFT, label: t("studentProfiles.status.draft", { defaultValue: "Draft" }) },
      {
        value: ProfileLifecycleStatus.INACTIVE,
        label: t("studentProfiles.status.inactive", { defaultValue: "Inactive" }),
      },
      {
        value: ProfileLifecycleStatus.ARCHIVED,
        label: t("studentProfiles.status.archived", { defaultValue: "Archived" }),
      },
    ],
    [t]
  );

  return (
    <div className="min-h-screen w-full bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("studentProfiles.title", { defaultValue: "Student Profiles" })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("studentProfiles.subtitle", {
              defaultValue: "Manage student records and parent contact information.",
            })}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleImportClick}>
              <Upload className="mr-2 h-4 w-4" />
              {t("studentProfiles.import.open", { defaultValue: "Import CSV" })}
            </Button>
            <Button onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              {t("studentProfiles.create", { defaultValue: "Add student profile" })}
            </Button>
          </div>
        </div>
      </div>

      {statusMessage ? (
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
          <div className="whitespace-pre-line">{statusMessage}</div>
        </div>
      ) : null}

      {fetchError ? (
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden />
          <div>{fetchError}</div>
        </div>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <form
                onSubmit={handleSearchSubmit}
                className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row sm:items-center"
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder={t("studentProfiles.searchPlaceholder", {
                      defaultValue: "Search by name, email, parent...",
                    })}
                    className="pl-9"
                  />
                </div>
                <Button type="submit" variant="secondary" className="w-full sm:w-auto">
                  {t("studentProfiles.searchAction", { defaultValue: "Search" })}
                </Button>
              </form>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value === "ALL" ? "ALL" : (value as ProfileLifecycleStatus))
                }
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t("studentProfiles.filterStatus", { defaultValue: "Status" })} />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                className="justify-start gap-2 sm:w-auto sm:justify-center"
                onClick={() => {
                  setSearchInput("");
                  setStatusFilter("ALL");
                  setCurrentPage(1);
                  setSearchQuery("");
                  setFilterInputs({ ...defaultAdvancedFilterInputs });
                  setAppliedFilters({});
                }}
                disabled={loading || !filtersDirty}
              >
                {t("studentProfiles.clearFilters", { defaultValue: "Clear filters" })}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadProfiles({ page: currentPage })}
              disabled={loading}
            >
              <Loader2 className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              {t("studentProfiles.refresh", { defaultValue: "Refresh" })}
            </Button>
          </div>

          <div className="space-y-2 rounded-md border border-dashed border-border/60 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAdvancedFiltersOpen((previous) => !previous)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                {advancedFiltersOpen
                  ? t("studentProfiles.filters.hide", { defaultValue: "Hide advanced filters" })
                  : t("studentProfiles.filters.show", { defaultValue: "Show advanced filters" })}
                {advancedFiltersActive ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {t("studentProfiles.filters.activeLabel", { defaultValue: "Active" })}
                  </span>
                ) : null}
              </Button>
              {advancedFilterChips.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {advancedFilterChips.map((chip) => (
                    <span key={chip} className="rounded-full bg-muted px-2 py-0.5">
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {advancedFiltersOpen ? (
              <div className="space-y-4 rounded-md border border-border bg-muted/40 p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1 text-sm">
                    <Label htmlFor="filter-name">
                      {t("studentProfiles.filters.nameLabel", { defaultValue: "Name contains" })}
                    </Label>
                    <Input
                      id="filter-name"
                      value={filterInputs.name}
                      onChange={(event) =>
                        setFilterInputs((previous) => ({ ...previous, name: event.target.value }))
                      }
                      placeholder={t("studentProfiles.filters.namePlaceholder", { defaultValue: "e.g. Arber" })}
                    />
                  </div>
                  <div className="space-y-1 text-sm">
                    <Label htmlFor="filter-email">
                      {t("studentProfiles.filters.emailLabel", { defaultValue: "Exact email" })}
                    </Label>
                    <Input
                      id="filter-email"
                      type="email"
                      value={filterInputs.email}
                      onChange={(event) =>
                        setFilterInputs((previous) => ({ ...previous, email: event.target.value }))
                      }
                      placeholder="student@kla.education"
                    />
                  </div>
                  <div className="space-y-1 text-sm">
                    <Label htmlFor="filter-grade">
                      {t("studentProfiles.filters.gradeLabel", { defaultValue: "Grade" })}
                    </Label>
                    <Select
                      value={filterInputs.grade || "ALL"}
                      onValueChange={(value) =>
                        setFilterInputs((previous) => ({ ...previous, grade: value === "ALL" ? "" : value }))
                      }
                    >
                      <SelectTrigger id="filter-grade">
                        <SelectValue
                          placeholder={t("studentProfiles.filters.gradePlaceholder", { defaultValue: "Any grade" })}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">
                          {t("studentProfiles.filters.gradeAny", { defaultValue: "Any grade" })}
                        </SelectItem>
                        {gradeOptions.map((grade) => (
                          <SelectItem key={grade} value={String(grade)}>
                            {grade === 0
                              ? t("studentProfiles.kindergartenValue", { defaultValue: "Kindergarten" })
                              : t("studentProfiles.gradeValue", { defaultValue: "Grade {{grade}}", grade })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 text-sm">
                    <Label htmlFor="filter-dob-from">
                      {t("studentProfiles.filters.dobFrom", { defaultValue: "Date of birth (from)" })}
                    </Label>
                    <Input
                      id="filter-dob-from"
                      type="date"
                      value={filterInputs.dateOfBirthFrom}
                      onChange={(event) =>
                        setFilterInputs((previous) => ({ ...previous, dateOfBirthFrom: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1 text-sm">
                    <Label htmlFor="filter-dob-to">
                      {t("studentProfiles.filters.dobTo", { defaultValue: "Date of birth (to)" })}
                    </Label>
                    <Input
                      id="filter-dob-to"
                      type="date"
                      value={filterInputs.dateOfBirthTo}
                      onChange={(event) =>
                        setFilterInputs((previous) => ({ ...previous, dateOfBirthTo: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1 text-sm">
                    <Label htmlFor="filter-updated-from">
                      {t("studentProfiles.filters.updatedFrom", { defaultValue: "Updated (from)" })}
                    </Label>
                    <Input
                      id="filter-updated-from"
                      type="date"
                      value={filterInputs.updatedFrom}
                      onChange={(event) =>
                        setFilterInputs((previous) => ({ ...previous, updatedFrom: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1 text-sm">
                    <Label htmlFor="filter-updated-to">
                      {t("studentProfiles.filters.updatedTo", { defaultValue: "Updated (to)" })}
                    </Label>
                    <Input
                      id="filter-updated-to"
                      type="date"
                      value={filterInputs.updatedTo}
                      onChange={(event) =>
                        setFilterInputs((previous) => ({ ...previous, updatedTo: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" onClick={() => handleSearchSubmit()}>
                    {t("studentProfiles.filters.apply", { defaultValue: "Apply filters" })}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilterInputs({ ...defaultAdvancedFilterInputs })}
                  >
                    {t("studentProfiles.filters.resetForm", { defaultValue: "Reset form" })}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("studentProfiles.loadingState", { defaultValue: "Loading student profiles..." })}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">{t("studentProfiles.table.name", { defaultValue: "Name" })}</th>
                  <th className="px-3 py-2">{t("studentProfiles.table.email", { defaultValue: "Email" })}</th>
                  <th className="px-3 py-2">{t("studentProfiles.table.grade", { defaultValue: "Grade" })}</th>
                  <th className="px-3 py-2">{t("studentProfiles.table.dob", { defaultValue: "Date of Birth" })}</th>
                  <th className="px-3 py-2">{t("studentProfiles.table.status", { defaultValue: "Status" })}</th>
                  <th className="px-3 py-2">{t("studentProfiles.table.updated", { defaultValue: "Updated" })}</th>
                  <th className="px-3 py-2 text-right">
                    {t("studentProfiles.table.actions", { defaultValue: "Actions" })}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && profiles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      {t("studentProfiles.loading", { defaultValue: "Loading student profiles..." })}
                    </td>
                  </tr>
                ) : null}

                {!loading && profiles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      {t("studentProfiles.empty", { defaultValue: "No student profiles found." })}
                    </td>
                  </tr>
                ) : null}

                {profiles.map((profile) => {
                  const student = (profile.student ?? {}) as Partial<NonNullable<UserProfileItem["student"]>>;
                  const studentGrade = resolveStudentGrade(profile);
                  const studentGradeLabel = formatStudentGradeLabel(studentGrade);
                  return (
                    <tr key={profile.pk} className="align-top">
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="font-medium">{student.fullName || profile.displayName || "—"}</div>
                        {profile.preferredName && profile.preferredName !== student.fullName ? (
                          <div className="text-xs text-muted-foreground">
                            {t("studentProfiles.preferred", {
                              defaultValue: "Preferred: {{name}}",
                              name: profile.preferredName,
                            })}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <div>{profile.primaryEmail ?? "—"}</div>
                        {profile.secondaryEmails && profile.secondaryEmails.length > 0 ? (
                          <div className="text-muted-foreground">{profile.secondaryEmails.join(", ")}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {studentGradeLabel ??
                          t("studentProfiles.gradeUnavailable", { defaultValue: "—" })}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                            profile.status === ProfileLifecycleStatus.ACTIVE
                              ? "bg-emerald-100 text-emerald-700"
                              : profile.status === ProfileLifecycleStatus.DRAFT
                                ? "bg-amber-100 text-amber-700"
                                : profile.status === ProfileLifecycleStatus.INACTIVE
                                  ? "bg-slate-200 text-slate-600"
                                  : "bg-rose-100 text-rose-700"
                          )}
                        >
                          {t(`studentProfiles.status.${profile.status}`, {
                            defaultValue: profile.status,
                          })}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {profile.updatedAt
                          ? new Date(profile.updatedAt).toLocaleString()
                          : t("studentProfiles.noUpdated", { defaultValue: "—" })}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openEditModal(profile)}>
                            <UserRoundPen className="mr-2 h-4 w-4" />
                            {t("studentProfiles.edit", { defaultValue: "Edit" })}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleRequestDelete(profile)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("studentProfiles.delete", { defaultValue: "Delete" })}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>{pageSummaryText}</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
              >
                {t("studentProfiles.prevPage", { defaultValue: "Previous" })}
              </Button>
              <div className="text-xs font-medium text-muted-foreground">
                {t("studentProfiles.pageIndicator", { defaultValue: "Page {{page}}", page: currentPage })}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!hasNextPage || loading}
              >
                {t("studentProfiles.nextPage", { defaultValue: "Next" })}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showImportModal} onOpenChange={handleImportModalOpenChange}>
        <DialogContent className="w-full max-w-[min(95vw,40rem)] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {t("studentProfiles.import.title", { defaultValue: "Import student profiles" })}
            </DialogTitle>
            <DialogDescription>
              {t("studentProfiles.import.description", {
                defaultValue: "Upload a CSV file to create or update student profiles in bulk.",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border border-dashed border-border px-4 py-3">
              <p className="text-sm font-medium">
                {t("studentProfiles.import.instructionsTitle", { defaultValue: "Steps" })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("studentProfiles.import.instructionsBody", {
                  defaultValue: "Download the template, populate it with student details, then upload the CSV here.",
                })}
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="justify-start gap-2 sm:w-fit"
              onClick={handleDownloadTemplate}
            >
              <FileDown className="h-4 w-4" />
              {t("studentProfiles.import.template", { defaultValue: "Download CSV template" })}
            </Button>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => importFileInputRef.current?.click()}
                disabled={importing}
              >
                {t("studentProfiles.import.selectFile", { defaultValue: "Choose CSV file" })}
              </Button>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportFileChange}
              />
              <span className="text-xs text-muted-foreground">
                {importFile
                  ? `${importFile.name}${importFile.size ? ` (${Math.round(importFile.size / 1024)} KB)` : ""}`
                  : t("studentProfiles.import.noFile", { defaultValue: "No file selected." })}
              </span>
            </div>

            {importParseErrors.length > 0 ? (
              <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {importParseErrors.map((message, index) => (
                  <p key={`parse-error-${index}`}>{message}</p>
                ))}
              </div>
            ) : null}

            {importStats.total > 0 ? (
              <div className="space-y-3 rounded-md border border-border bg-muted/40 px-3 py-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>{t("studentProfiles.import.previewLabel", { defaultValue: "Preview" })}</span>
                  <span>
                    {t("studentProfiles.import.previewCounts", {
                      defaultValue: "{{valid}} ready / {{invalid}} need attention",
                      valid: importStats.valid,
                      invalid: importStats.invalid,
                    })}
                  </span>
                </div>
                {previewErrors.length > 0 ? (
                  <div className="space-y-1 text-xs text-destructive">
                    {previewErrors.slice(0, 5).map((row) => (
                      <p key={`preview-error-${row.rowNumber}`}>
                        {t("studentProfiles.import.previewRowError", {
                          defaultValue: "Row {{row}} ({{email}}): {{message}}",
                          row: row.rowNumber,
                          email:
                            row.primaryEmail ??
                            t("studentProfiles.import.unknownEmail", { defaultValue: "unknown email" }),
                          message: row.errors.join("; "),
                        })}
                      </p>
                    ))}
                    {previewErrors.length > 5 ? (
                      <p className="text-[11px] text-muted-foreground">
                        {t("studentProfiles.import.moreErrors", {
                          defaultValue: "Resolve the remaining errors in the CSV and try again.",
                        })}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {previewReady.length > 0 ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {previewReady.slice(0, 5).map((row) => (
                      <p key={`preview-ready-${row.rowNumber}`}>
                        {t("studentProfiles.import.previewRowReady", {
                          defaultValue: "Row {{row}}: {{email}}",
                          row: row.rowNumber,
                          email:
                            row.primaryEmail ??
                            t("studentProfiles.import.unknownEmail", { defaultValue: "unknown email" }),
                        })}
                      </p>
                    ))}
                    {previewReady.length > 5 ? (
                      <p className="text-[11px]">
                        {t("studentProfiles.import.moreReady", {
                          defaultValue: "Additional rows are ready to import.",
                        })}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeImportJob ? (
              <div className="space-y-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                <div className="flex items-center justify-between font-medium">
                  <span>
                    {t("studentProfiles.import.statusLabel", { defaultValue: "Import status" })}:{" "}
                    {t(`studentProfiles.import.status.${activeImportJob.status}`, {
                      defaultValue: activeImportJob.status,
                    })}
                  </span>
                  <span>
                    {t("studentProfiles.import.progress", {
                      defaultValue: "Processing {{processed}} of {{total}} rows...",
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
              <div className="space-y-2 rounded-md border border-border px-3 py-2">
                <div className="text-sm font-medium">
                  {completedImportJob.message ??
                    t("studentProfiles.import.summary", {
                      defaultValue: "Processed {{processed}} rows - {{succeeded}} saved, {{failed}} failed.",
                      processed: completedImportJob.processedRows ?? 0,
                      succeeded: completedImportJob.successCount ?? 0,
                      failed: completedImportJob.failureCount ?? 0,
                    })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("studentProfiles.import.jobIdLabel", { defaultValue: "Job ID: {{id}}", id: completedImportJob.id })}
                </div>
                {completedImportJob.resultS3Key ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDownloadImportResult(completedImportJob)}
                  >
                    {t("studentProfiles.import.downloadResults", { defaultValue: "Download result log" })}
                  </Button>
                ) : null}
              </div>
            ) : null}

            {importError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {importError}
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {activeImportJob
                ? t("studentProfiles.import.progress", {
                    defaultValue: "Processing {{processed}} of {{total}} rows...",
                    processed: activeImportJob.processedRows ?? 0,
                    total: activeImportJob.totalRows ?? importStats.total,
                  })
                : completedImportJob
                ? t("studentProfiles.import.completedHint", {
                    defaultValue: "Import finished. You can close this window.",
                  })
                : t("studentProfiles.import.hint", {
                    defaultValue: "Only rows with valid data will be upserted.",
                  })}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleImportModalOpenChange(false)}
                disabled={importing}
              >
                {t("studentProfiles.import.close", { defaultValue: "Close" })}
              </Button>
              <Button
                type="button"
                onClick={() => void handleImportConfirm()}
                disabled={importing || importStats.valid === 0}
              >
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {importing
                  ? t("studentProfiles.import.importing", { defaultValue: "Importing..." })
                  : t("studentProfiles.import.start", { defaultValue: "Start import" })}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isModalOpen} onOpenChange={(open) => (open ? undefined : closeModal())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem
                ? t("studentProfiles.modal.editTitle", { defaultValue: "Edit student profile" })
                : t("studentProfiles.modal.createTitle", { defaultValue: "Create student profile" })}
            </DialogTitle>
            <DialogDescription>
              {t("studentProfiles.modal.subtitle", {
                defaultValue: "Student information is visible to authorized staff only.",
              })}
            </DialogDescription>
          </DialogHeader>

          <form
            id="student-profile-form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void onSubmit();
            }}
          >
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="userId">
                  {t("studentProfiles.form.userId", { defaultValue: "User ID" })}
                </Label>
                <Controller
                  name="userId"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="userId"
                      placeholder={t("studentProfiles.form.userIdPlaceholder", {
                        defaultValue: "Existing account user ID",
                      })}
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                      disabled={Boolean(editingItem)}
                    />
                  )}
                />
                {errors.userId ? (
                  <p className="mt-1 text-xs text-destructive">{errors.userId.message}</p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="status">
                  {t("studentProfiles.form.status", { defaultValue: "Lifecycle status" })}
                </Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ProfileLifecycleStatus.ACTIVE}>
                          {t("studentProfiles.status.active", { defaultValue: "Active" })}
                        </SelectItem>
                        <SelectItem value={ProfileLifecycleStatus.DRAFT}>
                          {t("studentProfiles.status.draft", { defaultValue: "Draft" })}
                        </SelectItem>
                        <SelectItem value={ProfileLifecycleStatus.INACTIVE}>
                          {t("studentProfiles.status.inactive", { defaultValue: "Inactive" })}
                        </SelectItem>
                        <SelectItem value={ProfileLifecycleStatus.ARCHIVED}>
                          {t("studentProfiles.status.archived", { defaultValue: "Archived" })}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="student.fullName">
                  {t("studentProfiles.form.studentName", { defaultValue: "Student full name" })}
                </Label>
                <Controller
                  name="student.fullName"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="student.fullName"
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
                {errors.student?.fullName ? (
                  <p className="mt-1 text-xs text-destructive">{errors.student.fullName.message}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="student.dateOfBirth">
                  {t("studentProfiles.form.dateOfBirth", { defaultValue: "Date of birth" })}
                </Label>
                <Controller
                  name="student.dateOfBirth"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="student.dateOfBirth"
                      placeholder="YYYY-MM-DD"
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
                {errors.student?.dateOfBirth ? (
                  <p className="mt-1 text-xs text-destructive">{errors.student.dateOfBirth.message}</p>
                ) : null}
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label htmlFor="primaryEmail">
                  {t("studentProfiles.form.primaryEmail", { defaultValue: "Primary email" })}
                </Label>
                <Controller
                  name="primaryEmail"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="primaryEmail"
                      placeholder="student@kla.education"
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
                {errors.primaryEmail ? (
                  <p className="mt-1 text-xs text-destructive">{errors.primaryEmail.message}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="tags">
                  {t("studentProfiles.form.tags", { defaultValue: "Tags (comma separated)" })}
                </Label>
                <Controller
                  name="tags"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="tags"
                      value={field.value.join(", ")}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value
                            .split(",")
                            .map((token) => token.trim())
                            .filter(Boolean)
                        )
                      }
                      placeholder={t("studentProfiles.form.tagsPlaceholder", {
                        defaultValue: "ClassA, Boarding",
                      })}
                    />
                  )}
                />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">
                  {t("studentProfiles.form.motherDetails", { defaultValue: "Mother / Guardian" })}
                </p>
                <Controller
                  name="student.motherName"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder={t("studentProfiles.form.namePlaceholder", { defaultValue: "Name" })}
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
                <Controller
                  name="student.motherEmail"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder="email@example.com"
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
                <Controller
                  name="student.motherPhone"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder={t("studentProfiles.form.phonePlaceholder", { defaultValue: "Phone" })}
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
                <Controller
                  name="student.motherProfession"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder={t("studentProfiles.form.professionPlaceholder", { defaultValue: "Profession" })}
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
              </div>
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">
                  {t("studentProfiles.form.fatherDetails", { defaultValue: "Father / Guardian" })}
                </p>
                <Controller
                  name="student.fatherName"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder={t("studentProfiles.form.namePlaceholder", { defaultValue: "Name" })}
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
                <Controller
                  name="student.fatherEmail"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder="email@example.com"
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
                <Controller
                  name="student.fatherPhone"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder={t("studentProfiles.form.phonePlaceholder", { defaultValue: "Phone" })}
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
                <Controller
                  name="student.fatherProfession"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder={t("studentProfiles.form.professionPlaceholder", { defaultValue: "Profession" })}
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="student.homeAddress">
                  {t("studentProfiles.form.address", { defaultValue: "Home address" })}
                </Label>
                <Controller
                  name="student.homeAddress"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      {...field}
                      id="student.homeAddress"
                      rows={2}
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
              </div>
              <div>
                <Label htmlFor="student.homeCity">
                  {t("studentProfiles.form.city", { defaultValue: "City" })}
                </Label>
                <Controller
                  name="student.homeCity"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="student.homeCity"
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="student.receivesSocialAssistance">
                  {t("studentProfiles.form.socialAssistance", {
                    defaultValue: "Receives social assistance?",
                  })}
                </Label>
                <Controller
                  name="student.receivesSocialAssistance"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value === null ? "unknown" : field.value ? "yes" : "no"}
                      onValueChange={(value) => field.onChange(value === "unknown" ? null : value === "yes")}
                    >
                      <SelectTrigger id="student.receivesSocialAssistance">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">
                          {t("studentProfiles.boolean.unknown", { defaultValue: "Unknown" })}
                        </SelectItem>
                        <SelectItem value="yes">
                          {t("studentProfiles.boolean.yes", { defaultValue: "Yes" })}
                        </SelectItem>
                        <SelectItem value="no">
                          {t("studentProfiles.boolean.no", { defaultValue: "No" })}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <Label htmlFor="student.livesWithBothParents">
                  {t("studentProfiles.form.livesWithParents", { defaultValue: "Lives with both parents?" })}
                </Label>
                <Controller
                  name="student.livesWithBothParents"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value === null ? "unknown" : field.value ? "yes" : "no"}
                      onValueChange={(value) => field.onChange(value === "unknown" ? null : value === "yes")}
                    >
                      <SelectTrigger id="student.livesWithBothParents">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">
                          {t("studentProfiles.boolean.unknown", { defaultValue: "Unknown" })}
                        </SelectItem>
                        <SelectItem value="yes">
                          {t("studentProfiles.boolean.yes", { defaultValue: "Yes" })}
                        </SelectItem>
                        <SelectItem value="no">
                          {livesWithParentsDetailsText
                            ? `${t("studentProfiles.boolean.no", { defaultValue: "No" })} — ${livesWithParentsDetailsText}`
                            : t("studentProfiles.boolean.no", { defaultValue: "No" })}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </section>

            <section
              className={cn(
                "transition-all duration-300 overflow-hidden",
                showLivesWithParentsDetails ? "max-h-[320px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
              )}
              aria-hidden={!showLivesWithParentsDetails}
            >
              <div className="space-y-2">
                <Label htmlFor="student.livesWithParentsDetails">
                  {t("studentProfiles.form.livesWithParentsDetails", {
                    defaultValue: "Helpful context (optional)",
                  })}
                </Label>
                <Controller
                  name="student.livesWithParentsDetails"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      {...field}
                      id="student.livesWithParentsDetails"
                      rows={3}
                      value={field.value ?? ""}
                      tabIndex={showLivesWithParentsDetails ? 0 : -1}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
              </div>
              <div>
                <Label>{t("studentProfiles.form.studentGrade", { defaultValue: "Student grade" })}</Label>
                <Input
                  value={activeStudentGradeLabel ?? ""}
                  readOnly
                  disabled
                  placeholder={t("studentProfiles.form.studentGradePending", {
                    defaultValue: "Unavailable until email is set",
                  })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("studentProfiles.form.studentGradeHint", {
                    defaultValue: "Auto-calculated from the primary email (e.g. username26 → Grade 12).",
                  })}
                </p>
              </div>
            </section>

            <section>
              <Label htmlFor="student.healthNotes">
                {t("studentProfiles.form.healthNotes", { defaultValue: "Health notes or allergies" })}
              </Label>
              <Controller
                name="student.healthNotes"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    id="student.healthNotes"
                    rows={3}
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                )}
              />
            </section>

            <section>
              <Label htmlFor="student.comments">
                {t("studentProfiles.form.comments", { defaultValue: "Comments" })}
              </Label>
              <Controller
                name="student.comments"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    id="student.comments"
                    rows={3}
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                )}
              />
            </section>

            <section>
              <Label htmlFor="notes">
                {t("studentProfiles.form.internalNotes", { defaultValue: "Internal notes" })}
              </Label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    id="notes"
                    rows={3}
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                )}
              />
            </section>
          </form>

          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {formError ? <span className="text-destructive">{formError}</span> : null}
              {errors.root ? <span className="text-destructive">{errors.root.message}</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
                {t("studentProfiles.modal.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button type="submit" form="student-profile-form" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingItem
                  ? t("studentProfiles.modal.saveChanges", { defaultValue: "Save changes" })
                  : t("studentProfiles.modal.createProfile", { defaultValue: "Create profile" })}
              </Button>
            </div>
          </DialogFooter>
      </DialogContent>
    </Dialog>
      <Dialog open={Boolean(profileToDelete)} onOpenChange={handleDeleteDialogChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("studentProfiles.deleteConfirmTitle", { defaultValue: "Delete student profile" })}
            </DialogTitle>
            <DialogDescription>
              {t("studentProfiles.deleteConfirmMessage", {
                defaultValue: "Are you sure you want to delete {{name}}? This cannot be undone.",
                name:
                  profileToDelete?.student?.fullName ||
                  profileToDelete?.displayName ||
                  profileToDelete?.primaryEmail ||
                  t("studentProfiles.deleteUnknown", { defaultValue: "this student" }),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleDeleteDialogChange(false)} disabled={deletingProfile}>
              {t("studentProfiles.deleteCancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={deletingProfile}
            >
              {deletingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("studentProfiles.deleteConfirm", { defaultValue: "Delete" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

function normalizeAdvancedFilters(inputs: AdvancedFilterInputs): AppliedAdvancedFilters {
  const name = normalizeFilterText(inputs.name);
  const email = normalizeFilterEmail(inputs.email);
  const grade = normalizeFilterGrade(inputs.grade);
  const dateOfBirthFrom = normalizeFilterDateOnly(inputs.dateOfBirthFrom);
  const dateOfBirthTo = normalizeFilterDateOnly(inputs.dateOfBirthTo);
  const updatedFrom = normalizeFilterUpdated(inputs.updatedFrom, "start");
  const updatedTo = normalizeFilterUpdated(inputs.updatedTo, "end");

  return {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(typeof grade === "number" ? { grade } : {}),
    ...(dateOfBirthFrom ? { dateOfBirthFrom } : {}),
    ...(dateOfBirthTo ? { dateOfBirthTo } : {}),
    ...(updatedFrom ? { updatedFrom } : {}),
    ...(updatedTo ? { updatedTo } : {}),
  };
}

function areAdvancedFiltersEqual(a: AppliedAdvancedFilters, b: AppliedAdvancedFilters): boolean {
  const keys: Array<keyof AppliedAdvancedFilters> = [
    "name",
    "email",
    "grade",
    "dateOfBirthFrom",
    "dateOfBirthTo",
    "updatedFrom",
    "updatedTo",
  ];
  return keys.every((key) => a[key] === b[key]);
}

function normalizeFilterText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function normalizeFilterEmail(value: string): string | undefined {
  const normalized = normalizeFilterText(value);
  return normalized ? normalized.toLowerCase() : undefined;
}

function normalizeFilterGrade(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed.length) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Math.round(parsed);
  if (rounded < 0 || rounded > 12) return undefined;
  return rounded;
}

function normalizeFilterDateOnly(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed.length) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

function normalizeFilterUpdated(value: string, boundary: "start" | "end"): string | undefined {
  const dateOnly = normalizeFilterDateOnly(value);
  if (!dateOnly) return undefined;
  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  return `${dateOnly}${suffix}`;
}
