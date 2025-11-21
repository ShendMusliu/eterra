export const USER_ROLE_IMPORT_HEADERS: readonly ["primaryEmail", "roles", "notes"] = [
  "primaryEmail",
  "roles",
  "notes",
] as const;

export type UserRoleImportRow = {
  rowNumber: number;
  primaryEmail: string | null;
  roles: string[];
  notes: string | null;
  errors: string[];
  warnings: string[];
  raw: Record<string, string>;
};

export type UserRoleImportParseResult = {
  header: string[];
  rows: UserRoleImportRow[];
  errors: string[];
};

export function parseUserRoleImportCsv(csv: string): UserRoleImportParseResult {
  const globalErrors: string[] = [];
  const rows: UserRoleImportRow[] = [];

  const lines = csv
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line, index, all) => {
      if (index === all.length - 1 && line.trim().length === 0) return false;
      return true;
    });

  if (lines.length === 0) {
    return { header: [], rows: [], errors: ["CSV file is empty."] };
  }

  const headerTokens = splitCsvLine(lines[0]).map((token) => token.trim());
  if (headerTokens.length === 0) {
    return { header: [], rows: [], errors: ["CSV header row is empty."] };
  }

  const headerIndex = new Map<string, number>();
  const canonicalHeaderIndex = new Map<string, number>();
  headerTokens.forEach((token, index) => {
    if (!headerIndex.has(token)) {
      headerIndex.set(token, index);
    }
    const canonical = canonicalizeHeader(token);
    if (!canonicalHeaderIndex.has(canonical)) {
      canonicalHeaderIndex.set(canonical, index);
    }
  });

  if (!canonicalHeaderIndex.has("primaryEmail")) {
    globalErrors.push("CSV header must include a 'primaryEmail' column.");
  }
  if (!canonicalHeaderIndex.has("roles")) {
    globalErrors.push("CSV header must include a 'roles' column.");
  }

  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const line = lines[i];
    if (!line.trim().length) continue;

    const tokens = splitCsvLine(line);
    const raw: Record<string, string> = {};
    headerTokens.forEach((token, index) => {
      const canonical = canonicalizeHeader(token);
      raw[canonical] = tokens[index]?.trim() ?? "";
    });

    rows.push(buildImportRow(raw, rowNumber));
  }

  return {
    header: headerTokens,
    rows,
    errors: globalErrors,
  };
}

export function buildTemplateCsv(): string {
  return `${USER_ROLE_IMPORT_HEADERS.join(",")}\n`;
}

export function normalizeEmail(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

export function normalizeRoles(input: string): string[] {
  if (typeof input !== "string") return [];
  const tokens = input
    .split(/[\s,;\n]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const valid: string[] = [];
  for (const token of tokens) {
    if (!/^[A-Za-z0-9_+=,.@-]{1,128}$/.test(token)) {
      throw new Error(`Invalid role name: ${token}`);
    }
    if (!valid.includes(token)) {
      valid.push(token);
    }
  }
  return valid;
}

function buildImportRow(raw: Record<string, string>, rowNumber: number): UserRoleImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const primaryEmailRaw = raw["primaryEmail"] ?? "";
  const primaryEmail = normalizeEmail(primaryEmailRaw);
  if (!primaryEmail) {
    errors.push("Primary email is required.");
  } else if (!isValidEmail(primaryEmail)) {
    errors.push("Primary email must be a valid email address.");
  }

  const rolesRaw = raw["roles"] ?? "";
  let roles: string[] = [];
  if (!rolesRaw.trim()) {
    errors.push("At least one role is required.");
  } else {
    try {
      roles = normalizeRoles(rolesRaw);
      if (roles.length === 0) {
        errors.push("At least one role is required.");
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Roles column contains invalid entries.");
    }
  }

  const notesRaw = raw["notes"] ?? "";
  const notes = optionalString(notesRaw);
  if (notes && notes.length > 1000) {
    warnings.push("Notes will be truncated to 1000 characters.");
  }

  return {
    rowNumber,
    primaryEmail,
    roles,
    notes,
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

function canonicalizeHeader(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "primaryemail") return "primaryEmail";
  if (normalized === "roles") return "roles";
  if (normalized === "notes") return "notes";
  return value.trim();
}

function optionalString(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
