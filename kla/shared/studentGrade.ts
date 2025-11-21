const EMAIL_SUFFIX_REGEX = /(\d{4}|\d{2})$/;
const MIN_GRADE = 0;
const MAX_GRADE = 12;
const CENTURY_PREFIX = 2000;
const YEAR_CUTOFF = 2100;

export type GradeComputationOptions = {
  referenceDate?: Date;
  academicYearRolloverMonth?: number;
};

/**
 * Returns the expected graduation year based on the numeric suffix that appears
 * at the end of a kla.education email (e.g. `student26@kla.education` → 2026).
 */
export function deriveGraduationYearFromEmail(email?: string | null): number | null {
  if (!email) return null;
  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return null;

  const match = localPart.match(EMAIL_SUFFIX_REGEX);
  if (!match) return null;

  const token = match[1];
  const parsed = Number.parseInt(token, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }

  if (token.length === 4) {
    return parsed >= CENTURY_PREFIX && parsed <= YEAR_CUTOFF ? parsed : null;
  }

  const year = CENTURY_PREFIX + parsed;
  return year <= YEAR_CUTOFF ? year : null;
}

/**
 * Converts a graduation year into the current grade (0 = Kindergarten, 1-12 otherwise)
 * using the provided reference date. We treat July (month index 6) as the academic rollover
 * by default (i.e. once we reach July we assume the upcoming class is the current Grade 12 cohort).
 */
export function deriveStudentGradeFromEmail(
  email?: string | null,
  options: GradeComputationOptions = {}
): number | null {
  const graduationYear = deriveGraduationYearFromEmail(email);
  if (!graduationYear) return null;

  const referenceDate = options.referenceDate ?? new Date();
  const rolloverMonth =
    typeof options.academicYearRolloverMonth === "number" ? options.academicYearRolloverMonth : 6;

  const currentYear = referenceDate.getUTCFullYear();
  const currentMonth = referenceDate.getUTCMonth();
  const currentSeniorGraduationYear = currentMonth >= rolloverMonth ? currentYear + 1 : currentYear;

  const grade = MAX_GRADE - (graduationYear - currentSeniorGraduationYear);
  if (grade < MIN_GRADE || grade > MAX_GRADE) {
    return null;
  }
  return grade;
}
