import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateClient } from "aws-amplify/data";
import { uploadData } from "aws-amplify/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Schema } from "../../../amplify/data/resource";

const POSITIONS = [
  "Teacher",
  "Teaching Assistant",
  "Administrative Staff",
  "IT Specialist",
  "Cleaning Staff",
  "Other",
];

const kosovoPhonePattern = /^\+383\s\d{2}\s\d{3}\s\d{3}$/;
const MAX_PHONE_LENGTH = "+383 45 123 456".length;

function formatKosovoPhoneInput(raw: string): string {
  if (!raw) return "+383 ";

  let digits = raw.replace(/\D/g, "");
  if (!digits) return "+383 ";

  if (!digits.startsWith("383")) {
    digits = `383${digits}`;
  }

  const rest = digits.slice(3, 11); // at most 8 digits after country code

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

// ---- Validation schema (aligns with backend: resumeKey is required) ----
const schema = z.object({
  fullName: z.string().min(2, "Required"),
  email: z.string().email("Invalid email"),
  phone: z
    .string()
    .trim()
    .regex(kosovoPhonePattern, "Use format 383 45 123 456"),
  position: z.string().min(1, "Required"),
  coverLetter: z.string().min(10, "Required"),
  // Use instanceof(File) on the client. If you render on server, switch to z.custom<File>(...)
  resumeFile: z
    .instanceof(File, { message: "Resume file is required" })
    .refine(
      (f) =>
        ["application/pdf",
         "application/msword",
         "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(
          f.type
        ),
      "Only PDF/DOC/DOCX allowed"
    )
    .refine((f) => f.size <= 5 * 1024 * 1024, "Max 5MB"),
  comments: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const client = generateClient<Schema>();

export default function ApplyWork() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    // Important: don't include resumeFile here so RHF doesn't treat it as optional.
    defaultValues: {
      fullName: "",
      email: "",
      phone: "+383 ",
      position: "",
      coverLetter: "",
      comments: "",
    } as Partial<FormData>,
    mode: "onBlur",
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setSubmitError(null);
    try {
      // Build a stable, non-guessable S3 key
      const safeName = data.fullName.trim().replace(/\s+/g, "-").toLowerCase();
      const random = Math.random().toString(36).slice(2, 8);
      const resumePath = `incoming/forms/resumes/${Date.now()}-${safeName}-${random}-${data.resumeFile.name}`;

      // Upload to S3 (guest PUT allowed for this prefix)
      await uploadData({
        path: resumePath,
        data: data.resumeFile,
        options: { contentType: data.resumeFile.type },
      }).result;

      // Persist application (resumeKey required in schema)
      await client.models.WorkApplication.create({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        position: data.position,
        coverLetter: data.coverLetter,
        resumeKey: resumePath,
        comments: data.comments,
      });

      setSubmitted(true);
      reset();
      // Clear the actual file input element for good UX
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Also clear RHF's internal value to avoid stale state
      setValue("resumeFile", undefined as unknown as File, {
        shouldDirty: false,
        shouldValidate: false,
      });
    } catch (err: unknown) {
      console.error("Submit failed", err);
      const fallbackMessage = t("unexpectedError", "Something went wrong!");
      setSubmitError(err instanceof Error && err.message ? err.message : fallbackMessage);
    }
  };

  return (
    <div className="bg-background min-h-screen pt-20 pb-12">
      <div className="mx-auto w-full max-w-5xl px-3 sm:px-6">
        <Card className="w-full">
          <CardContent className="px-4 py-8 sm:px-8 sm:py-10">
            <h1 className="text-3xl font-semibold mb-6">
              {t("applyWork", "Apply to Work at Our School")}
            </h1>

            {submitted ? (
              <div className="space-y-4 py-6">
                <p className="text-green-600 font-semibold text-lg">
                  {t(
                    "applyWorkSubmitted",
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
                className="space-y-6"
                onSubmit={handleSubmit(onSubmit)}
                autoComplete="off"
                noValidate
              >
                {/* Full Name */}
                <div>
                  <Label htmlFor="fullName">{t("fullName", "Full Name")}</Label>
                  <Input id="fullName" {...register("fullName")} />
                  {errors.fullName && (
                    <span className="text-red-600 text-xs">
                      {errors.fullName.message}
                    </span>
                  )}
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="email">{t("email", "Email")}</Label>
                  <Input id="email" type="email" {...register("email")} />
                  {errors.email && (
                    <span className="text-red-600 text-xs">
                      {errors.email.message}
                    </span>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <Label htmlFor="phone">{t("phone", "Phone number")}</Label>
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field }) => (
                      <Input
                        id="phone"
                        inputMode="numeric"
                        maxLength={MAX_PHONE_LENGTH}
                        placeholder="+383 45 123 456"
                        value={field.value}
                        onChange={(event) =>
                          field.onChange(
                            formatKosovoPhoneInput(event.target.value)
                          )
                        }
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    )}
                  />
                  {errors.phone && (
                    <span className="text-red-600 text-xs">
                      {errors.phone.message}
                    </span>
                  )}
                </div>

                {/* Position */}
                <div>
                  <Label htmlFor="position">
                    {t("positionLabel", "Which position are you applying for?")}
                  </Label>
                  <Controller
                    control={control}
                    name="position"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="position" className="w-full">
                          <SelectValue
                            placeholder={t("selectPosition", "Select position")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {POSITIONS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {t(`positions.${p}`, p)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.position && (
                    <span className="text-red-600 text-xs">
                      {errors.position.message}
                    </span>
                  )}
                </div>

                {/* Cover Letter */}
                <div>
                  <Label htmlFor="coverLetter">
                    {t("coverLetter", "Cover letter / Motivation")}
                  </Label>
                  <Textarea id="coverLetter" {...register("coverLetter")} />
                  {errors.coverLetter && (
                    <span className="text-red-600 text-xs">
                      {errors.coverLetter.message}
                    </span>
                  )}
                </div>

                {/* Resume File */}
                <div>
                  <Label htmlFor="resumeFile">
                    {t("resume", "Upload CV / Resume")}
                  </Label>
                  <Input
                    id="resumeFile"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    {...register("resumeFile")}
                    ref={fileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setValue("resumeFile", file, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }
                    }}
                  />
                  {errors.resumeFile && (
                    <span className="text-red-600 text-xs">
                      {errors.resumeFile.message as string}
                    </span>
                  )}
                </div>

                {/* Comments */}
                <div>
                  <Label htmlFor="comments">
                    {t("extraComments", "Extra comments")} {" "}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({t("optional", "optional")})
                    </span>
                  </Label>
                  <Textarea id="comments" {...register("comments")} />
                </div>

                {submitError && (
                  <div className="text-red-600 text-sm">{submitError}</div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full mt-4 sm:w-auto sm:ml-auto sm:block"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? t("submitting", "Submitting...")
                    : t("submit", "Submit")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}




