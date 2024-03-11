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
  id?: string;
  loading?: boolean;
  onChange?: (value: T) => void;
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
  id,
  loading,
  onChange,
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
        className={cn(triggerClassName, {
          'disabled:cursor-wait': loading,
        })}
        id={id}
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
          <SelectItem key={value} className={'max-w-[80vw]'} value={value}>
            {caption}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectUi>
  );
};
