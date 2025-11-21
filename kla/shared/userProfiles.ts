import { z } from "zod";

export enum UserType {
  STUDENT = "STUDENT",
  STAFF = "STAFF",
  PARENT = "PARENT",
  OTHER = "OTHER",
}

export enum ProfileLifecycleStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
}

export type StudentProfileInput = {
  fullName: string;
  dateOfBirth?: string | null;
  motherName?: string | null;
  motherEmail?: string | null;
  motherPhone?: string | null;
  motherProfession?: string | null;
  fatherName?: string | null;
  fatherEmail?: string | null;
  fatherPhone?: string | null;
  fatherProfession?: string | null;
  healthNotes?: string | null;
  receivesSocialAssistance?: boolean | null;
  livesWithBothParents?: boolean | null;
  livesWithParentsDetails?: string | null;
  comments?: string | null;
  homeAddress?: string | null;
  homeCity?: string | null;
};

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const optionalString = z
  .string()
  .trim()
  .max(300, "Value is too long.")
  .optional()
  .transform((value) => {
    if (value === undefined) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }) as unknown as z.ZodType<string | null, z.ZodTypeDef, string | undefined>;

const optionalEmail = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : undefined))
  .optional()
  .refine((value) => value === undefined || EMAIL_REGEX.test(value), {
    message: "Enter a valid email.",
  })
  .transform((value) => {
    if (!value) return null;
    return value.toLowerCase();
  }) as unknown as z.ZodType<string | null, z.ZodTypeDef, string | undefined>;

const optionalPhone = z
  .string()
  .trim()
  .min(3, "Enter a valid phone number.")
  .max(30, "Phone number is too long.")
  .optional()
  .transform((value) => {
    if (value === undefined) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }) as unknown as z.ZodType<string | null, z.ZodTypeDef, string | undefined>;

const optionalBoolean = z
  .union([z.boolean(), z.literal(""), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value === "boolean") return value;
    return null;
  }) as unknown as z.ZodType<boolean | null, z.ZodTypeDef, boolean | "" | null | undefined>;

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (value === undefined) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!ISO_DATE_REGEX.test(trimmed)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: "Use YYYY-MM-DD format.",
          path: [],
        },
      ]);
    }
    return trimmed;
  }) as unknown as z.ZodType<string | null, z.ZodTypeDef, string | undefined>;

export const studentProfileFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Student name is required.")
    .max(160, "Name is too long."),
  dateOfBirth: optionalDate,
  motherName: optionalString,
  motherEmail: optionalEmail,
  motherPhone: optionalPhone,
  motherProfession: optionalString,
  fatherName: optionalString,
  fatherEmail: optionalEmail,
  fatherPhone: optionalPhone,
  fatherProfession: optionalString,
  healthNotes: optionalString,
  receivesSocialAssistance: optionalBoolean,
  livesWithBothParents: optionalBoolean,
  livesWithParentsDetails: optionalString,
  comments: optionalString,
  homeAddress: optionalString,
  homeCity: optionalString,
});

export type StudentProfileFormValues = z.infer<typeof studentProfileFormSchema>;

export const studentUserProfileFormSchema = z.object({
  userId: z.string().trim().min(1, "userId is required."),
  userType: z.nativeEnum(UserType),
  status: z.nativeEnum(ProfileLifecycleStatus).default(ProfileLifecycleStatus.ACTIVE),
  displayName: optionalString,
  legalName: optionalString,
  preferredName: optionalString,
  primaryEmail: optionalEmail,
  secondaryEmails: z
    .array(
      z
        .string()
        .trim()
        .email("Enter a valid email.")
        .transform((value) => value.toLowerCase())
    )
    .optional()
    .transform((value) => value ?? []),
  phoneNumbers: z
    .array(
      z
        .string()
        .trim()
        .min(3, "Enter a valid phone number.")
        .max(30, "Phone number is too long.")
    )
    .optional()
    .transform((value) => value ?? []),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tag may not be empty.")
        .max(50, "Tag is too long.")
    )
    .optional()
    .transform((value) => value ?? []),
  notes: optionalString,
  student: studentProfileFormSchema,
});

export type StudentUserProfileFormValues = z.infer<typeof studentUserProfileFormSchema>;

export type AdminUpsertUserProfileInput = {
  userId: string;
  userType: UserType;
  status?: ProfileLifecycleStatus | null;
  displayName?: string | null;
  legalName?: string | null;
  preferredName?: string | null;
  primaryEmail?: string | null;
  secondaryEmails?: string[];
  phoneNumbers?: string[];
  student?: StudentProfileInput | null;
  tags?: string[];
  notes?: string | null;
  archivedAt?: string | null;
  deactivatedAt?: string | null;
  completedAt?: string | null;
  lastReviewedAt?: string | null;
};

export const buildStudentProfileInput = (values: StudentProfileFormValues): StudentProfileInput => ({
  fullName: values.fullName.trim(),
  dateOfBirth: values.dateOfBirth ?? null,
  motherName: values.motherName,
  motherEmail: normalizeEmail(values.motherEmail),
  motherPhone: values.motherPhone,
  motherProfession: values.motherProfession,
  fatherName: values.fatherName,
  fatherEmail: normalizeEmail(values.fatherEmail),
  fatherPhone: values.fatherPhone,
  fatherProfession: values.fatherProfession,
  healthNotes: values.healthNotes,
  receivesSocialAssistance: values.receivesSocialAssistance ?? null,
  livesWithBothParents: values.livesWithBothParents ?? null,
  livesWithParentsDetails: values.livesWithParentsDetails,
  comments: values.comments,
  homeAddress: values.homeAddress,
  homeCity: values.homeCity,
});

export const buildAdminUpsertUserProfileInput = (
  values: StudentUserProfileFormValues,
  options: Partial<
    Pick<
      AdminUpsertUserProfileInput,
      "status" | "archivedAt" | "deactivatedAt" | "completedAt" | "lastReviewedAt"
    >
  > = {}
): AdminUpsertUserProfileInput => {
  const {
    status = values.status,
    archivedAt = null,
    deactivatedAt = null,
    completedAt = null,
    lastReviewedAt = null,
  } = options;

  return {
    userId: values.userId.trim(),
    userType: values.userType,
    status,
    displayName: values.displayName,
    legalName: values.legalName,
    preferredName: values.preferredName,
    primaryEmail: normalizeEmail(values.primaryEmail),
    secondaryEmails: values.secondaryEmails?.map((email) => email.toLowerCase()) ?? [],
    phoneNumbers: values.phoneNumbers ?? [],
    tags: values.tags ?? [],
    notes: values.notes,
    student: buildStudentProfileInput(values.student),
    archivedAt,
    deactivatedAt,
    completedAt,
    lastReviewedAt,
  };
};

function normalizeEmail(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}
