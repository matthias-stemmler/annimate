import { cn } from '@/lib/utils';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { ComponentProps, FC } from 'react';

const Separator: FC<ComponentProps<typeof SeparatorPrimitive.Root>> = ({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}) => (
  <SeparatorPrimitive.Root
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'bg-border shrink-0',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...props}
  />
);

export { Separator };
