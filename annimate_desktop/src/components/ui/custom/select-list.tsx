import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FC, Key, useId } from 'react';

export type SelectListProps<T> = {
  disabled?: boolean;
  label: string;
  onClick?: (value: T) => void;
  onClickAll?: () => void;
  renderValue: (value: T) => string;
  selectedValues: T[];
  values: T[];
};

export const SelectList = <T extends Key>({
  disabled,
  label,
  onClick,
  onClickAll,
  renderValue,
  selectedValues,
  values,
}: SelectListProps<T>) => (
  <ScrollArea className="h-full">
    <ul aria-label={label} className="pb-1">
      <SelectListItem
        checked={
          values.every((v) => selectedValues.includes(v)) ||
          (values.some((v) => selectedValues.includes(v)) && 'indeterminate')
        }
        className="italic"
        disabled={disabled}
        label="All"
        onClick={onClickAll}
      />

      <Separator />

      {values.map((value) => (
        <SelectListItem
          key={value}
          checked={selectedValues.includes(value)}
          disabled={disabled}
          label={renderValue(value)}
          onClick={() => onClick?.(value)}
        />
      ))}
    </ul>
  </ScrollArea>
);

type SelectListItemProps = {
  checked: boolean | 'indeterminate';
  className?: string;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
};

const SelectListItem: FC<SelectListItemProps> = ({
  checked,
  className,
  disabled,
  label,
  onClick,
}) => {
  const id = useId();

  return (
    <li aria-label={label} className={className}>
      <Label
        htmlFor={id}
        className="cursor-pointer flex items-center gap-2 p-1 hover:bg-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70"
      >
        <Checkbox
          id={id}
          aria-label={label}
          checked={checked}
          disabled={disabled}
          onClick={onClick}
        />
        {label}
      </Label>
    </li>
  );
};
