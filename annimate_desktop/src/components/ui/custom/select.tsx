import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  options: SelectOption<T>[] | SelectOptionGroup<T>[];
  value?: T;
};

export type SelectOption<T> = {
  caption: ReactNode;
  value: T;
};

export type SelectOptionGroup<T> = {
  groupCaption?: ReactNode;
  groupItems: SelectOption<T>[];
  groupKey: string;
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
  const allOptions = options.flatMap((optionOrGroup) =>
    'groupKey' in optionOrGroup ? optionOrGroup.groupItems : [optionOrGroup],
  );

  const placeholder =
    (loading && 'Loading ...') ||
    (allOptions.length === 0 && 'No options available');

  return (
    <SelectUi
      disabled={disabled || loading || allOptions.length === 0}
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
              : allOptions.find((option) => option.value === value)?.caption
          }
          placeholder={placeholder}
        />
      </SelectTrigger>

      <SelectContent>
        {options.map((optionOrGroup) => {
          if ('groupKey' in optionOrGroup) {
            const { groupCaption, groupItems, groupKey } = optionOrGroup;

            return (
              <SelectGroup key={groupKey} className="mt-4 first:mt-0">
                {groupCaption === undefined ? null : (
                  <SelectLabel>{groupCaption}</SelectLabel>
                )}
                {groupItems.map((option) => (
                  <SelectOptionDisplay key={option.value} option={option} />
                ))}
              </SelectGroup>
            );
          }

          return (
            <SelectOptionDisplay
              key={optionOrGroup.value}
              option={optionOrGroup}
            />
          );
        })}
      </SelectContent>
    </SelectUi>
  );
};

type SelectOptionDisplayProps<T> = {
  option: SelectOption<T>;
};

const SelectOptionDisplay = <T extends string>({
  option,
}: SelectOptionDisplayProps<T>) => (
  <SelectItem className="max-w-[80vw]" value={option.value}>
    {option.caption}
  </SelectItem>
);
