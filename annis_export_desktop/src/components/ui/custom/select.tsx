import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  Select as SelectUi,
  SelectValue,
} from '@/components/ui/select';
import { ReactNode } from 'react';

export type SelectProps<T> = {
  disabled?: boolean;
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
  onChange,
  options,
  triggerClassName,
  value,
}: SelectProps<T>) => (
  <SelectUi disabled={disabled} onValueChange={onChange} value={value}>
    <SelectTrigger className={triggerClassName}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map(({ caption, value }) => (
        <SelectItem key={value} value={value}>
          {caption}
        </SelectItem>
      ))}
    </SelectContent>
  </SelectUi>
);
