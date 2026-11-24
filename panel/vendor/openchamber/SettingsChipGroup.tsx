import React from 'react'; import {cn} from './utils'; import {Button} from './button';
interface SettingsChipOption<T extends string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
  selectedClassName?: string;
  tooltip?: React.ReactNode;
}

interface SettingsChipGroupProps<T extends string> {
  value: T;
  options: Array<SettingsChipOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  'aria-label'?: string;
}
export function SettingsChipGroup<T extends string>({
  value,
  options,
  onChange,
  className,
  'aria-label': ariaLabel,
}: SettingsChipGroupProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'oc-recessed inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const selected = value === option.value;
        const chip = (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="sm"
            disabled={option.disabled}
            aria-pressed={selected}
            className={cn(
              'rounded-md !font-normal',
              selected
                ? option.selectedClassName
                  ?? 'oc-raised bg-[var(--surface-background)] text-foreground hover:bg-[var(--surface-background)] dark:bg-[var(--surface-elevated)] dark:hover:bg-[var(--surface-elevated)]'
                : 'text-muted-foreground hover:bg-transparent hover:text-foreground',
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
        return chip;
      })}
    </div>
  );
}
