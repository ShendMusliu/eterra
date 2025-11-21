const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const FLEX_DATE_REGEX = /^(\d{1,2})\s*[\/\-\.,]\s*(\d{1,2})\s*[\/\-\.,]\s*(\d{4})$/;

export enum WorkerUserType {
  STUDENT = "STUDENT",
  STAFF = "STAFF",
  PARENT = "PARENT",
  OTHER = "OTHER",
}

export enum WorkerProfileLifecycleStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
}

export type WorkerStudentProfile = {
  fullName: string;
  dateOfBirth: string | null;
  motherName: string | null;
  motherEmail: string | null;
  motherPhone: string | null;
  motherProfession: string | null;
  fatherName: string | null;
  fatherEmail: string | null;
  fatherPhone: string | null;
  fatherProfession: string | null;
  healthNotes: string | null;
  receivesSocialAssistance: boolean | null;
  livesWithBothParents: boolean | null;
  livesWithParentsDetails: string | null;
  comments: string | null;
  homeAddress: string | null;
  homeCity: string | null;
};

export type WorkerStudentUserProfileFormValues = {
  userId: string;
  userType: WorkerUserType;
  status: WorkerProfileLifecycleStatus;
  displayName: string | null;
  legalName: string | null;
  preferredName: string | null;
  primaryEmail: string | null;
  secondaryEmails: string[];
  phoneNumbers: string[];
  tags: string[];
  notes: string | null;
  student: WorkerStudentProfile;
};

export type WorkerStudentProfileImportProfile = Omit<WorkerStudentUserProfileFormValues, "userId">;

export type WorkerStudentProfileImportRow = {
  rowNumber: number;
  primaryEmail: string | null;
  profile: WorkerStudentProfileImportProfile | null;
  errors: string[];
  warnings: string[];
  raw: Record<string, string>;
};

export type WorkerStudentProfileImportParseResult = {
  rows: WorkerStudentProfileImportRow[];
  header: string[];
  errors: string[];
};

export function parseStudentProfileCsv(csv: string): WorkerStudentProfileImportParseResult {
  const rows: WorkerStudentProfileImportRow[] = [];
  const errors: string[] = [];

  const lines = csv
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line, index, all) => {
      if (index === all.length - 1 && line.trim().length === 0) return false;
      return true;
    });

  if (lines.length === 0) {
    return { rows: [], header: [], errors: ["CSV file is empty."] };
  }

  const headerTokens = splitCsvLine(lines[0]).map((token) => token.trim());
  if (headerTokens.length === 0) {
    return { rows: [], header: [], errors: ["CSV header row is empty."] };
  }

  const header = headerTokens;
  const headerIndex = new Map<string, number>();
  header.forEach((token, index) => {
    headerIndex.set(token, index);
  });

  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const line = lines[i];
    if (!line.trim().length) continue;

    const tokens = splitCsvLine(line);
    const raw: Record<string, string> = {};
    header.forEach((token, index) => {
      raw[token] = tokens[index]?.trim() ?? "";
    });

    rows.push(buildImportRow(raw, rowNumber));
  }

  return { rows, header, errors };
}

export function buildStudentProfileValues(
  row: WorkerStudentProfileImportRow,
  userId: string
): WorkerStudentUserProfileFormValues | null {
  if (!row.profile || row.errors.length > 0) return null;
  return {
    ...row.profile,
    userId,
  };
}

export function buildAdminUpsertUserProfileInput(
  values: WorkerStudentUserProfileFormValues,
  options: Partial<{
    status: WorkerProfileLifecycleStatus | null;
    archivedAt: string | null;
    deactivatedAt: string | null;
    completedAt: string | null;
    lastReviewedAt: string | null;
  }> = {}
): Record<string, unknown> {
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
    secondaryEmails: values.secondaryEmails.map((email) => email.toLowerCase()),
    phoneNumbers: values.phoneNumbers,
    tags: values.tags,
    notes: values.notes,
    student: buildStudentProfileInput(values.student),
    archivedAt,
    deactivatedAt,
    completedAt,
    lastReviewedAt,
  };
}

function buildStudentProfileInput(values: WorkerStudentProfile) {
  return {
    fullName: values.fullName,
    dateOfBirth: values.dateOfBirth,
    motherName: values.motherName,
    motherEmail: normalizeEmail(values.motherEmail),
    motherPhone: values.motherPhone,
    motherProfession: values.motherProfession,
    fatherName: values.fatherName,
    fatherEmail: normalizeEmail(values.fatherEmail),
    fatherPhone: values.fatherPhone,
    fatherProfession: values.fatherProfession,
    healthNotes: values.healthNotes,
    receivesSocialAssistance: values.receivesSocialAssistance,
    livesWithBothParents: values.livesWithBothParents,
    livesWithParentsDetails: values.livesWithParentsDetails,
    comments: values.comments,
    homeAddress: values.homeAddress,
    homeCity: values.homeCity,
  };
}

function buildImportRow(raw: Record<string, string>, rowNumber: number): WorkerStudentProfileImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const primaryEmailRaw = raw["primaryEmail"] ?? "";
  const primaryEmail = normalizeEmail(primaryEmailRaw);
  if (!primaryEmail) {
    errors.push("Primary email is required.");
  } else if (!EMAIL_REGEX.test(primaryEmail)) {
    errors.push("Primary email must be a valid email address.");
  }

  const statusRaw = raw["status"] ?? "";
  const status = parseStatus(statusRaw, errors);

  const studentFirstName = optionalString(raw["student.firstName"]);
  const studentLastName = optionalString(raw["student.lastName"]);
  const combinedName = buildFullName(studentFirstName, studentLastName);
  const fallbackName = primaryEmail
    ? primaryEmail.split("@")[0]?.replace(/[\.\-_]/g, " ").trim()
    : "";
  const studentFullName = combinedName || fallbackName || null;
  if (!studentFullName) {
    warnings.push("Student name missing; using primary email as identifier.");
  }

  const studentDateOfBirth = optionalDate(raw["student.dateOfBirth"], errors);

  const studentMotherName = optionalString(raw["student.motherName"]);
  const studentMotherEmail = optionalEmail(raw["student.motherEmail"], errors, "Mother email");
  const studentMotherPhone = optionalString(raw["student.motherPhone"]);
  const studentMotherProfession = optionalString(raw["student.motherProfession"]);

  const studentFatherName = optionalString(raw["student.fatherName"]);
  const studentFatherEmail = optionalEmail(raw["student.fatherEmail"], errors, "Father email");
  const studentFatherPhone = optionalString(raw["student.fatherPhone"]);
  const studentFatherProfession = optionalString(raw["student.fatherProfession"]);

  const studentHealthNotes = optionalString(raw["student.healthNotes"]);
  const studentReceivesSocialAssistance = optionalBoolean(
    raw["student.receivesSocialAssistance"],
    errors,
    "Receives social assistance"
  );
  const studentLivesWithBothParents = optionalBoolean(
    raw["student.livesWithBothParents"],
    errors,
    "Lives with both parents"
  );
  const studentLivesWithParentsDetails = optionalString(raw["student.livesWithParentsDetails"]);
  const studentComments = optionalString(raw["student.comments"]);
  const studentHomeAddress = optionalString(raw["student.homeAddress"]);
  const studentHomeCity = optionalString(raw["student.homeCity"]);

  const displayName = studentFullName ?? null;
  const legalName = studentFullName ?? null;

  const profile: WorkerStudentProfileImportProfile | null =
    primaryEmail && errors.length === 0
      ? {
          userType: WorkerUserType.STUDENT,
          status,
          displayName,
          legalName,
          preferredName: null,
          primaryEmail,
          secondaryEmails: [],
          phoneNumbers: [],
          tags: [],
          notes: null,
          student: {
            fullName: studentFullName && studentFullName.length > 0 ? studentFullName : "Student",
            dateOfBirth: studentDateOfBirth,
            motherName: studentMotherName,
            motherEmail: studentMotherEmail,
            motherPhone: studentMotherPhone,
            motherProfession: studentMotherProfession,
            fatherName: studentFatherName,
            fatherEmail: studentFatherEmail,
            fatherPhone: studentFatherPhone,
            fatherProfession: studentFatherProfession,
            healthNotes: studentHealthNotes,
            receivesSocialAssistance: studentReceivesSocialAssistance,
            livesWithBothParents: studentLivesWithBothParents,
            livesWithParentsDetails: studentLivesWithParentsDetails,
            comments: studentComments,
            homeAddress: studentHomeAddress,
            homeCity: studentHomeCity,
          },
        }
      : null;

  return {
    rowNumber,
    primaryEmail: primaryEmail ?? null,
    profile,
    errors,
    warnings,
    raw,
  };
}

function splitCsvLine(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      tokens.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || line.endsWith(",")) {
    tokens.push(current);
  }

  return tokens;
}

function optionalString(value?: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function optionalEmail(value: string | undefined, errors: string[], label: string): string | null {
  const normalized = normalizeEmail(value);
  if (!normalized) return null;
  if (!EMAIL_REGEX.test(normalized)) {
    errors.push(`${label} must be a valid email address.`);
    return null;
  }
  return normalized;
}

function optionalBoolean(value: string | undefined, errors: string[], label: string): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["yes", "y", "true", "t", "1"].includes(normalized)) return true;
  if (["no", "n", "false", "f", "0"].includes(normalized)) return false;
  if (["unknown", "na", "n/a", "null"].includes(normalized)) return null;
  errors.push(`${label} must be one of: yes/no/unknown.`);
  return null;
}

function optionalDate(value: string | undefined, errors: string[]): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (ISO_DATE_REGEX.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(FLEX_DATE_REGEX);
  if (match) {
    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const year = Number.parseInt(match[3], 10);
    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year) || day < 1 || month < 1 || month > 12) {
      errors.push(`Dates must use DD/MM/YYYY format (received: ${value}).`);
      return null;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day
    ) {
      errors.push(`Dates must use DD/MM/YYYY format (received: ${value}).`);
      return null;
    }
    const iso = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}`;
    return iso;
  }
  errors.push(`Dates must use DD/MM/YYYY format (received: ${value}).`);
  return null;
}

function parseStatus(value: string | undefined, errors: string[]): WorkerProfileLifecycleStatus {
  if (!value) return WorkerProfileLifecycleStatus.ACTIVE;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return WorkerProfileLifecycleStatus.ACTIVE;
  if (normalized in WorkerProfileLifecycleStatus) {
    return WorkerProfileLifecycleStatus[normalized as keyof typeof WorkerProfileLifecycleStatus];
  }
  errors.push(`Invalid status value: ${value}`);
  return WorkerProfileLifecycleStatus.ACTIVE;
}

function normalizeEmail(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

function buildFullName(firstName: string | null, lastName: string | null): string | null {
  const parts = [firstName, lastName].filter((part): part is string => Boolean(part && part.trim()));
  if (parts.length === 0) return null;
  return parts.join(" ").trim();
}
