// src/pages/public/ApplyStudent.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateClient } from "aws-amplify/data";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { Schema } from "../../../amplify/data/resource";
const GRADES = ["K", ...Array.from({ length: 12 }, (_, i) => String(i + 1))];

const kosovoPhonePattern = /^\+383\s\d{2}\s\d{3}\s\d{3}$/;
const MAX_PHONE_LENGTH = "+383 45 123 456".length;

function formatKosovoPhoneInput(raw: string): string {
  if (!raw) return "";

  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (!digits.startsWith("383")) {
    digits = `383${digits}`;
  }

  const rest = digits.slice(3, 11);
  if (rest.length === 0) {
    return "+383 ";
  }

  let formatted = "+383";
  const firstBlock = rest.slice(0, Math.min(2, rest.length));
  formatted += ` ${firstBlock}`;

  if (rest.length > 2) {
    const secondBlock = rest.slice(2, Math.min(5, rest.length));
    formatted += ` ${secondBlock}`;
  }

  if (rest.length > 5) {
    const thirdBlock = rest.slice(5, Math.min(8, rest.length));
    formatted += ` ${thirdBlock}`;
  }

  return formatted;
}

const requiresLivesWithParentsComment = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase();
  return normalized === "jo" || normalized === "no" || normalized === "false";
};

// Zod schema for validation (aligned with backend fields)
const schema = z
  .object({
    // Student
    fullName: z.string().min(2, "Required"),
    dob: z.date({ required_error: "Required" }),
    desiredGrade: z.string().min(1, "Required"),
    gender: z.string().optional(),
    city: z.string().min(1, "Required"),
    address: z.string().min(1, "Required"),
    livesWithParents: z.string().optional(),
    livesWithParentsComment: z.string().optional(),
    medicalNotes: z.string().optional(),

    // Mother/guardian
    motherName: z.string().min(2, "Required"),
    motherEmail: z.string().email("Invalid email"),
    motherPhone: z
      .string()
      .trim()
      .regex(kosovoPhonePattern, "Use format +383 45 123 456"),
    motherJob: z.string().optional(),

    // Father/guardian
    fatherName: z.string().min(2, "Required"),
    fatherEmail: z.string().email("Invalid email"),
    fatherPhone: z
      .string()
      .trim()
      .regex(kosovoPhonePattern, "Use format +383 45 123 456"),
    fatherJob: z.string().optional(),

    // Other
    socialAssistance: z.string().optional(),
    motivation: z.string().min(10, "Required"),
    comments: z.string().optional(),

    // Honeypot
    _hp: z.string().optional(),
  })
  .refine((vals) => !vals._hp, { path: ["_hp"], message: "" })
  .superRefine((vals, ctx) => {
    if (requiresLivesWithParentsComment(vals.livesWithParents)) {
      if (!vals.livesWithParentsComment || !vals.livesWithParentsComment.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["livesWithParentsComment"],
          message: "Please provide a reason or comment.",
        });
      }
    }
  });

type FormData = z.infer<typeof schema>;

const client = generateClient<Schema>();

export default function ApplyStudent() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [openDob, setOpenDob] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [invalidSummary, setInvalidSummary] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      dob: undefined,
      desiredGrade: "",
      gender: "",
      city: "",
      address: "",
      livesWithParents: "",
      livesWithParentsComment: "",
      medicalNotes: "",
      motherName: "",
      motherEmail: "",
      motherPhone: "+383 ",
      motherJob: "",
      fatherName: "",
      fatherEmail: "",
      fatherPhone: "+383 ",
      fatherJob: "",
      socialAssistance: "",
      motivation: "",
      comments: "",
      _hp: "",
    },
  });

  const livesWithParentsValue = watch("livesWithParents");
  const livesWithParentsCommentValue = watch("livesWithParentsComment");
  const livesWithParentsCommentText = (livesWithParentsCommentValue ?? "").trim();
  const showLivesWithParentsComment = requiresLivesWithParentsComment(livesWithParentsValue);

  useEffect(() => {
    if (!showLivesWithParentsComment) {
      setValue("livesWithParentsComment", "");
    }
  }, [showLivesWithParentsComment, setValue]);

  async function onSubmit(data: FormData) {
    setSubmitError(null);
    setInvalidSummary(null);
    // Client-side basic rate limit: 90 seconds between submissions
    try {
      const key = "applyStudentLastSubmit";
      const last = localStorage.getItem(key);
      if (last) {
        const elapsed = Date.now() - Number(last);
        if (elapsed < 90_000) {
          setSubmitError(t("rateLimited", "Please wait a bit before submitting again."));
          return;
        }
      }
    } catch {}
    try {
      await client.models.StudentApplication.create({
        fullName: data.fullName,
        dob: format(data.dob, "yyyy-MM-dd"), // local-date safe (no TZ shifts)
        desiredGrade: data.desiredGrade,
        gender: data.gender || undefined,
        city: data.city || undefined,
        address: data.address || undefined,
        livesWithParents: data.livesWithParents || undefined,
        livesWithParentsComment: data.livesWithParentsComment?.trim() || undefined,
        medicalNotes: data.medicalNotes || undefined,
        motherName: data.motherName,
        motherEmail: data.motherEmail,
        motherPhone: data.motherPhone.trim(),
        motherJob: data.motherJob || undefined,
        fatherName: data.fatherName,
        fatherEmail: data.fatherEmail,
        fatherPhone: data.fatherPhone.trim(),
        fatherJob: data.fatherJob || undefined,
        socialAssistance: data.socialAssistance || undefined,
        motivation: data.motivation,
        comments: data.comments || undefined,
      });
      setSubmitted(true);
      reset(); // optionally: reset({ dob: undefined }) if you want the DOB cleared explicitly
      try { localStorage.setItem("applyStudentLastSubmit", String(Date.now())); } catch {}
    } catch (err: unknown) {
      const fallbackMessage = t("unexpectedError", "Something went wrong!");
      setSubmitError(err instanceof Error && err.message ? err.message : fallbackMessage);
    }
  }

  function onInvalid(errs: FieldErrors<FormData>) {
    const entries = Object.entries(errs ?? {});
    const inlineLabels: Record<keyof FormData, string> = {
      fullName: t("fullName", "Full Name"),
      dob: t("dob", "Date of Birth"),
      desiredGrade: t("desiredGrade", "Desired grade"),
      gender: t("gender", "Gender"),
      city: t("city", "City"),
      address: t("address", "Address"),
      livesWithParents: t("livesWithParents", "Lives with parents"),
      livesWithParentsComment: t("livesWithParentsComment", "Reason/comment"),
      medicalNotes: t("medicalNotes", "Medical notes"),
      motherName: t("motherName", "Mother name"),
      motherEmail: t("motherEmail", "Mother email"),
      motherPhone: t("motherPhone", "Mother phone"),
      motherJob: t("motherJob", "Mother profession"),
      fatherName: t("fatherName", "Father name"),
      fatherEmail: t("fatherEmail", "Father email"),
      fatherPhone: t("fatherPhone", "Father phone"),
      fatherJob: t("fatherJob", "Father profession"),
      socialAssistance: t("socialAssistance", "Social assistance"),
      motivation: t("motivation", "Motivation"),
      comments: t("extraComments", "Extra comments"),
      _hp: "",
    };

    const fieldList = entries
      .map(([key]) => inlineLabels[key as keyof FormData])
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");

    setInvalidSummary(
      fieldList
        ? t("fixErrorsDetailed", "Please review: {{fields}}", { fields: fieldList })
        : t("fixErrors", "Please fix the highlighted fields."),
    );

    if (entries.length > 0) {
      const [firstKey, firstError] = entries[0];
      const el = document.getElementById(firstKey);
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        try { (el as HTMLElement).focus?.(); } catch {}
      }
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("Student application validation errors", firstKey, firstError);
      }
    }
  }

  return (
    <div className="bg-background min-h-screen pt-20 pb-12">
      <div className="mx-auto w-full max-w-5xl px-3 sm:px-6">
        <Card className="w-full">
          <CardContent className="px-4 py-8 sm:px-8 sm:py-10">
            <h1 className="text-3xl font-semibold mb-6">
              {t("applyStudent", "Apply to Become a Student")}
            </h1>

            {submitted ? (
              <div className="space-y-4 py-6">
                <p className="text-green-600 font-semibold text-lg">
                  {t(
                    "applyStudentSubmitted",
                    "Your application has been received!"
                  )}
                </p>
                <Button
                  variant="outline"
                  onClick={() => setSubmitted(false)}
                  className="w-full sm:w-auto"
                >
                  {t("submitAnother", "Submit another application")}
                </Button>
              </div>
            ) : (
              <form
                className="space-y-8"
                onSubmit={handleSubmit(onSubmit, onInvalid)}
                autoComplete="off"
                noValidate
              >
                {/* Honeypot */}
                <input
                  id="_hp"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                  {...register("_hp")}
                />

                {invalidSummary && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {invalidSummary}
                  </div>
                )}

                {/* Student */}
                <section>
                  <h2 className="text-lg font-medium">{t("studentInfo", "Student Information")}</h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="fullName" className="mb-1">{t("fullName", "Full Name")}</Label>
                      <Input id="fullName" {...register("fullName")} />
                      {errors.fullName && <span className="text-red-600 text-xs">{errors.fullName.message}</span>}
                    </div>
                    <div>
                      <Label htmlFor="dob" className="mb-1">{t("dob", "Date of Birth")}</Label>
                      <Controller
                        control={control}
                        name="dob"
                        render={({ field }) => (
                          <Popover open={openDob} onOpenChange={setOpenDob}>
                            <PopoverTrigger asChild>
                              <Button id="dob" variant="outline" className="w-full justify-between font-normal" type="button" aria-haspopup="dialog" aria-expanded={openDob} aria-controls="dob-popover" aria-invalid={!!errors.dob || undefined} aria-describedby={errors.dob ? "dob-error" : undefined} aria-errormessage={errors.dob ? "dob-error" : undefined}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : t("selectDob", "Select date of birth")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent id="dob-popover" className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date ?? field.value); setOpenDob(false); }} captionLayout="dropdown" fromYear={1900} toYear={new Date().getFullYear()} disabled={{ after: new Date() }} />
                            </PopoverContent>
                          </Popover>
                        )}
                      />
                      {errors.dob && <span id="dob-error" className="text-red-600 text-xs">{errors.dob.message as string}</span>}
                    </div>
                    <div>
                      <Label htmlFor="gender" className="mb-1">{t("gender", "Gender")}</Label>
                      <select id="gender" className="w-full rounded-md border px-3 h-10 bg-background" {...register("gender")}>
                        <option value="">{t("select", "Select")}</option>
                        <option value="F">{t("female", "Female")}</option>
                        <option value="M">{t("male", "Male")}</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="city" className="mb-1">{t("city", "City")}</Label>
                      <Input id="city" {...register("city")} />
                      {errors.city && <span className="text-red-600 text-xs">{errors.city.message}</span>}
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="address" className="mb-1">{t("address", "Address")}</Label>
                      <Input id="address" {...register("address")} />
                      {errors.address && <span className="text-red-600 text-xs">{errors.address.message}</span>}
                    </div>
                    <div>
                      <Label htmlFor="desiredGrade" className="mb-1">{t("desiredGrade", "Desired grade")}</Label>
                      <Controller
                        control={control}
                        name="desiredGrade"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange} required>
                            <SelectTrigger id="desiredGrade" className="w-full" aria-invalid={!!errors.desiredGrade || undefined} aria-describedby={errors.desiredGrade ? "desiredGrade-error" : undefined} aria-errormessage={errors.desiredGrade ? "desiredGrade-error" : undefined}>
                              <SelectValue placeholder={t("selectGrade", "Select grade")} />
                            </SelectTrigger>
                            <SelectContent>
                              {GRADES.map((g) => (
                                <SelectItem key={g} value={g}>{t(`grades.${g}`, `Grade ${g}`)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.desiredGrade && <span id="desiredGrade-error" className="text-red-600 text-xs">{errors.desiredGrade.message}</span>}
                    </div>
                    <div>
                      <Label htmlFor="livesWithParents" className="mb-1">{t("livesWithParents", "Does the child live with both parents?")}</Label>
                      <select id="livesWithParents" className="w-full rounded-md border px-3 h-10 bg-background" {...register("livesWithParents")}>
                        <option value="">{t("select", "Select")}</option>
                        <option value="Po">Po</option>
                        <option value="Jo">
                          {livesWithParentsCommentText
                            ? `${t("livesWithParentsNoOption", "Jo")} — ${livesWithParentsCommentText}`
                            : t("livesWithParentsNoOption", "Jo")}
                        </option>
                      </select>
                    </div>
                    <div
                      className={`sm:col-span-2 grid overflow-hidden transition-all duration-300 ${showLivesWithParentsComment ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"}`}
                      aria-hidden={!showLivesWithParentsComment}
                    >
                      <div className="overflow-hidden">
                        <Label htmlFor="livesWithParentsComment" className="mb-1">
                          {t("livesWithParentsComment", "Reason/Comment")}
                        </Label>
                        <Textarea
                          id="livesWithParentsComment"
                          rows={3}
                          placeholder={t("livesWithParentsCommentPlaceholder", "Add any helpful context")}
                          aria-invalid={!!errors.livesWithParentsComment || undefined}
                          aria-describedby={errors.livesWithParentsComment ? "livesWithParentsComment-error" : undefined}
                          aria-errormessage={errors.livesWithParentsComment ? "livesWithParentsComment-error" : undefined}
                          className="transition-opacity duration-300"
                          tabIndex={showLivesWithParentsComment ? 0 : -1}
                          {...register("livesWithParentsComment")}
                        />
                        {errors.livesWithParentsComment && (
                          <span id="livesWithParentsComment-error" className="text-red-600 text-xs">
                            {errors.livesWithParentsComment.message}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="medicalNotes" className="mb-1">{t("medicalNotes", "Medical conditions/allergies we should know about?")}</Label>
                      <Textarea id="medicalNotes" rows={3} {...register("medicalNotes")} />
                    </div>
                  </div>
                </section>

                {/* Mother/guardian */}
                <section>
                  <h2 className="text-lg font-medium">{t("motherInfo", "Mother/Guardian")}</h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="motherName" className="mb-1">{t("motherName", "Full name")}</Label>
                      <Input id="motherName" {...register("motherName")} />
                      {errors.motherName && <span className="text-red-600 text-xs">{errors.motherName.message}</span>}
                    </div>
                    <div>
                      <Label htmlFor="motherEmail" className="mb-1">{t("motherEmail", "Email")}</Label>
                      <Input id="motherEmail" type="email" {...register("motherEmail")} />
                      {errors.motherEmail && <span className="text-red-600 text-xs">{errors.motherEmail.message}</span>}
                    </div>
                    <div>
                      <Label htmlFor="motherPhone" className="mb-1">{t("motherPhone", "Phone")}</Label>
                      <Controller
                        control={control}
                        name="motherPhone"
                        render={({ field }) => (
                          <Input
                            id="motherPhone"
                            inputMode="numeric"
                            maxLength={MAX_PHONE_LENGTH}
                            value={field.value ?? "+383 "}
                            onChange={(event) => field.onChange(formatKosovoPhoneInput(event.target.value))}
                            onBlur={field.onBlur}
                            ref={field.ref}
                          />
                        )}
                      />
                      {errors.motherPhone && <span className="text-red-600 text-xs">{errors.motherPhone.message}</span>}
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="motherJob" className="mb-1">{t("motherJob", "Profession")}</Label>
                      <Input id="motherJob" {...register("motherJob")} />
                    </div>
                  </div>
                </section>

                {/* Father/guardian */}
                <section>
                  <h2 className="text-lg font-medium">{t("fatherInfo", "Father/Guardian")}</h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="fatherName" className="mb-1">{t("fatherName", "Full name")}</Label>
                      <Input id="fatherName" {...register("fatherName")} />
                      {errors.fatherName && <span className="text-red-600 text-xs">{errors.fatherName.message}</span>}
                    </div>
                    <div>
                      <Label htmlFor="fatherEmail" className="mb-1">{t("fatherEmail", "Email")}</Label>
                      <Input id="fatherEmail" type="email" {...register("fatherEmail")} />
                      {errors.fatherEmail && <span className="text-red-600 text-xs">{errors.fatherEmail.message}</span>}
                    </div>
                    <div>
                      <Label htmlFor="fatherPhone" className="mb-1">{t("fatherPhone", "Phone")}</Label>
                      <Controller
                        control={control}
                        name="fatherPhone"
                        render={({ field }) => (
                          <Input
                            id="fatherPhone"
                            inputMode="numeric"
                            maxLength={MAX_PHONE_LENGTH}
                            value={field.value ?? "+383 "}
                            onChange={(event) => field.onChange(formatKosovoPhoneInput(event.target.value))}
                            onBlur={field.onBlur}
                            ref={field.ref}
                          />
                        )}
                      />
                      {errors.fatherPhone && <span className="text-red-600 text-xs">{errors.fatherPhone.message}</span>}
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="fatherJob" className="mb-1">{t("fatherJob", "Profession")}</Label>
                      <Input id="fatherJob" {...register("fatherJob")} />
                    </div>
                  </div>
                </section>

                {/* General */}
                <section>
                  <h2 className="text-lg font-medium">{t("general", "General")}</h2>
                  <div className="mt-4 grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="socialAssistance" className="mb-1">{t("socialAssistance", "Do you receive social assistance?")}</Label>
                      <select id="socialAssistance" className="w-full rounded-md border px-3 h-10 bg-background" {...register("socialAssistance")}>
                        <option value="">{t("select", "Select")}</option>
                        <option>Po</option>
                        <option>Jo</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="motivation" className="mb-1">{t("motivation", "Why are you interested in our school?")}</Label>
                      <Textarea id="motivation" {...register("motivation")} />
                      {errors.motivation && <span className="text-red-600 text-xs">{errors.motivation.message}</span>}
                    </div>
                    <div>
                      <Label htmlFor="comments" className="mb-1">{t("extraComments", "Extra comments")} <span className="text-xs text-muted-foreground ml-2">({t("optional", "optional")})</span></Label>
                      <Textarea id="comments" {...register("comments")} />
                    </div>
                  </div>
                </section>
                {submitError && (
                  <div className="text-red-600 text-sm">{submitError}</div>
                )}
                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full mt-2 sm:w-auto sm:ml-auto sm:block"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t("submitting", "Submitting...") : t("submit", "Submit")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
