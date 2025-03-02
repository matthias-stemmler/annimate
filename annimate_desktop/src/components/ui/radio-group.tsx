import { cn } from '@/lib/utils';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Circle } from 'lucide-react';
import { ComponentProps, FC } from 'react';

const RadioGroup: FC<ComponentProps<typeof RadioGroupPrimitive.Root>> = ({
  className,
  ...props
}) => (
  <RadioGroupPrimitive.Root
    className={cn('grid gap-2', className)}
    {...props}
  />
);

const RadioGroupItem: FC<ComponentProps<typeof RadioGroupPrimitive.Item>> = ({
  className,
  ...props
}) => (
  <RadioGroupPrimitive.Item
    className={cn(
      'border-primary text-primary ring-offset-background focus-visible:ring-ring aspect-square size-4 rounded-full border focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <Circle className="size-2.5 fill-current text-current" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
);

export { RadioGroup, RadioGroupItem };
