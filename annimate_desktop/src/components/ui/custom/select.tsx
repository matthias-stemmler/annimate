import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  Select as SelectUi,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ComponentPropsWithoutRef, ReactNode } from 'react';

export type SelectProps<T> = Omit<
  ComponentPropsWithoutRef<typeof SelectTrigger>,
  'onChange'
> & {
  disabled?: boolean;
  id?: string;
  loading?: boolean;
  onChange?: (value: T) => void;
  options: SelectOption<T>[];
  value?: T;
};

export type SelectOption<T> = {
  caption: ReactNode;
  value: T;
};

export const Select = <T extends string>({
  className,
  disabled,
  id,
  loading,
  onChange,
  options,
  value,
  ...triggerProps
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
        className={cn(className, {
          'disabled:cursor-wait': loading,
        })}
        id={id}
        {...triggerProps}
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
