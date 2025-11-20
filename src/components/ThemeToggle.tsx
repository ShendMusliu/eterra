import { useTheme } from '@/contexts/ThemeContext';

const options = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const;

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 shadow-sm ${className}`}
    >
      <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Theme</span>
      <select
        aria-label="Theme"
        value={theme}
        onChange={(event) => setTheme(event.target.value as typeof options[number]['value'])}
        className="rounded-md border border-transparent bg-transparent text-sm font-medium text-[hsl(var(--foreground))] focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
