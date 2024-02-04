import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { CheckedState } from '@radix-ui/react-checkbox';
import { FC, Key, PropsWithChildren, ReactNode, useId } from 'react';

export type SelectListProps<T> = {
  values: T[];
  selectedValues: T[];
  renderValue: (value: T) => ReactNode;
  onClick?: (value: T) => void;
  onClickAll?: () => void;
};

export const SelectList = <T extends Key>({
  values,
  selectedValues,
  renderValue,
  onClick,
  onClickAll,
}: SelectListProps<T>) => (
  <ScrollArea className="h-full pr-4">
    <ul>
      <SelectListItem
        checked={
          values.every((v) => selectedValues.includes(v)) ||
          (values.some((v) => selectedValues.includes(v)) && 'indeterminate')
        }
        onClick={onClickAll}
        className="italic"
      >
        All
      </SelectListItem>

      <Separator />

      {values.map((value) => (
        <SelectListItem
          key={value}
          checked={selectedValues.includes(value)}
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
  onClick?: () => void;
  className?: string;
}>;

const SelectListItem: FC<SelectListItemProps> = ({
  children,
  checked,
  onClick,
  className,
}) => {
  const id = useId();

  return (
    <li
      className={cn(
        'flex items-center gap-2 p-1 cursor-pointer hover:bg-accent',
        className,
      )}
      onClick={onClick}
    >
      <Checkbox id={id} checked={checked} />
      <Label htmlFor={id} className="cursor-pointer" onClick={onClick}>
        {children}
      </Label>
    </li>
  );
};
