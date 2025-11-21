import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type LoaderSize = "sm" | "md" | "lg";
type LoaderVariant = "fullscreen" | "page" | "inline";

type LoaderProps = {
  message?: string;
  size?: LoaderSize;
  variant?: LoaderVariant;
  className?: string;
};

const sizeClasses: Record<LoaderSize, string> = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
};

const variantClasses: Record<LoaderVariant, string> = {
  fullscreen: "min-h-screen",
  page: "min-h-[50vh]",
  inline: "min-h-fit",
};

export default function Loader({
  message,
  size = "md",
  variant = "page",
  className,
}: LoaderProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "flex w-full items-center justify-center",
        variantClasses[variant],
        className
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner className={cn(sizeClasses[size], "text-primary")} />
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}
