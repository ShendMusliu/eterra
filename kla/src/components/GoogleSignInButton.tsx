import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type GoogleSignInButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
};

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 18 18"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="#4285F4"
      d="M17.64 9.2045c0-0.6381-0.0573-1.2516-0.1636-1.8405H9v3.4811h4.8445c-0.2091 1.125-0.8427 2.0805-1.7954 2.7214v2.2583h2.9086c1.7045-1.5699 2.6822-3.8836 2.6822-6.6203z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.4673-0.8068 5.9568-2.1873l-2.9086-2.2583c-0.8068 0.541-1.8386 0.859-3.0482 0.859-2.3455 0-4.3323-1.5845-5.041-3.7082H0.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
    />
    <path
      fill="#FBBC05"
      d="M3.9591 10.7055c-0.1827-0.541-0.2872-1.1186-0.2872-1.7055s0.1045-1.1645 0.2872-1.7055V4.9627H0.9573C0.3491 6.1723 0 7.5464 0 9c0 1.4536 0.3491 2.8277 0.9573 4.0373l3.0018-2.3318z"
    />
    <path
      fill="#EA4335"
      d="M9 3.5795c1.3213 0 2.5073 0.4541 3.4405 1.345l2.5827-2.5827C13.4673 0.8914 11.43 0 9 0 5.4818 0 2.4382 2.0168 0.9573 4.9627l3.0018 2.3318C4.6677 5.1636 6.6545 3.5795 9 3.5795z"
    />
  </svg>
);

GoogleIcon.displayName = "GoogleIcon";

export const GoogleSignInButton = forwardRef<HTMLButtonElement, GoogleSignInButtonProps>(
  ({ className, loading = false, children, disabled, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(
        "relative flex h-12 w-full items-center justify-center rounded-lg border border-[#dadce0] bg-white px-4 text-sm font-medium text-[#3c4043] shadow-[0_1px_1px_rgba(0,0,0,0.1),0_1px_3px_rgba(60,64,67,0.08)] transition-all duration-150 hover:shadow-[0_1px_2px_rgba(60,64,67,0.3),0_1px_6px_rgba(60,64,67,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4285f4] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-80 dark:focus-visible:ring-offset-slate-900",
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <span className="absolute left-4 flex items-center">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-[#4285f4]" aria-hidden="true" />
        ) : (
          <GoogleIcon className="h-5 w-5" />
        )}
      </span>
      <span className="flex items-center justify-center text-sm font-medium leading-none tracking-wide">
        {children}
      </span>
    </button>
  )
);

GoogleSignInButton.displayName = "GoogleSignInButton";
