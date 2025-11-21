import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { USER_ROLES, UserRole } from "../../shared/userRoles";

type RoleSelectorProps = {
  id?: string;
  value: UserRole[];
  onChange: (roles: UserRole[]) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function RoleSelector({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  placeholder = "Select roles",
  className,
}: RoleSelectorProps) {
  const [open, setOpen] = useState(false);

  const summaryLabel = useMemo(() => {
    if (!value.length) {
      return placeholder;
    }
    if (value.length <= 3) {
      return value.join(", ");
    }
    const [first, second, third] = value;
    if (value.length === 4) {
      return `${first}, ${second}, ${third}, +1`;
    }
    return `${first}, ${second}, +${value.length - 2}`;
  }, [placeholder, value]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      onBlur?.();
    }
  };

  const toggleRole = (role: UserRole) => {
    if (disabled) return;
    if (value.includes(role)) {
      onChange(value.filter((item) => item !== role));
      return;
    }
    const next = [...value, role].sort(
      (a, b) => USER_ROLES.indexOf(a) - USER_ROLES.indexOf(b)
    );
    onChange(next);
  };

  const handleClear = () => {
    if (disabled || value.length === 0) return;
    onChange([]);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-normal",
            !value.length && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{summaryLabel}</span>
          <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] space-y-3 sm:w-[480px] lg:w-[640px]">
        <header className="space-y-1">
          <p className="text-sm font-medium text-foreground">Roles</p>
          <p className="text-xs text-muted-foreground">
            Toggle the roles that should be applied to the user's token.
          </p>
        </header>
        <div className="flex flex-wrap gap-2">
          {USER_ROLES.map((role) => {
            const selected = value.includes(role);
            return (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:border-primary/50 hover:text-primary"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border border-current text-primary",
                    selected ? "opacity-100" : "opacity-0"
                  )}
                >
                  <Check aria-hidden className="h-3 w-3" />
                </span>
                <span>{role}</span>
              </button>
            );
          })}
        </div>
        <footer className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {value.length
              ? `${value.length} ${value.length === 1 ? "role selected" : "roles selected"}`
              : "No roles selected"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled || value.length === 0}
          >
            Clear
          </Button>
        </footer>
      </PopoverContent>
    </Popover>
  );
}
