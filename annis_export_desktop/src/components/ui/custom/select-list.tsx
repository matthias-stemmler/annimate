import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CheckedState } from '@radix-ui/react-checkbox';
import { FC, Key, PropsWithChildren, ReactNode, useId } from 'react';

export type SelectListProps<T> = {
  disabled?: boolean;
  onClick?: (value: T) => void;
  onClickAll?: () => void;
  renderValue: (value: T) => ReactNode;
  selectedValues: T[];
  values: T[];
};

export const SelectList = <T extends Key>({
  disabled,
  onClick,
  onClickAll,
  renderValue,
  selectedValues,
  values,
}: SelectListProps<T>) => (
  <ScrollArea className="h-full pr-4">
    <ul className="pb-1">
      <SelectListItem
        checked={
          values.every((v) => selectedValues.includes(v)) ||
          (values.some((v) => selectedValues.includes(v)) && 'indeterminate')
        }
        className="italic"
        disabled={disabled}
        onClick={onClickAll}
      >
        All
      </SelectListItem>

      <Separator />

      {values.map((value) => (
        <SelectListItem
          key={value}
          checked={selectedValues.includes(value)}
          disabled={disabled}
          onClick={() => onClick?.(value)}
        >
          {renderValue(value)}
        </SelectListItem>
      ))}
    </ul>
  </ScrollArea>
);

type SelectListItemProps = PropsWithChildren<{
  checked: CheckedState;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}>;

const SelectListItem: FC<SelectListItemProps> = ({
  children,
  checked,
  className,
  disabled,
  onClick,
}) => {
  const id = useId();

  return (
    <li className={className}>
      <Label
        htmlFor={id}
        className="cursor-pointer flex items-center gap-2 p-1 hover:bg-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70"
      >
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          onClick={onClick}
        />
        {children}
      </Label>
    </li>
  );
};
