import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  Select as SelectUi,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export type SelectProps<T> = {
  disabled?: boolean;
  loading?: boolean;
  onChange?: (value: T) => void;
  optionClassName?: string;
  options: SelectOption<T>[];
  triggerClassName?: string;
  value?: T;
};

export type SelectOption<T> = {
  caption: ReactNode;
  value: T;
};

export const Select = <T extends string>({
  disabled,
  loading,
  onChange,
  optionClassName,
  options,
  triggerClassName,
  value,
}: SelectProps<T>) => {
  const placeholder =
    (loading && 'Loading ...') ||
    (options.length === 0 && 'No options available');

  return (
    <SelectUi
      disabled={disabled || loading || options.length === 0}
      onValueChange={onChange}
      value={value ?? ''}
    >
      <SelectTrigger
        className={cn(optionClassName, triggerClassName, {
          'disabled:cursor-wait': loading,
        })}
      >
        <SelectValue
          children={
            value === undefined
              ? placeholder
              : options.find((o) => o.value === value)?.caption
          }
          placeholder={placeholder}
        />
      </SelectTrigger>

      <SelectContent>
        {options.map(({ caption, value }) => (
          <SelectItem key={value} className={optionClassName} value={value}>
            {caption}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectUi>
  );
};
