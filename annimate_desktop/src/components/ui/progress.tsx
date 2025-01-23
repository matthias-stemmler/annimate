import { cn } from '@/lib/utils';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { ComponentProps, FC } from 'react';

const Progress: FC<ComponentProps<typeof ProgressPrimitive.Root>> = ({
  className,
  value,
  ...props
}) => (
  <ProgressPrimitive.Root
    className={cn(
      'bg-secondary relative h-4 w-full overflow-hidden rounded-full',
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="bg-primary h-full w-full flex-1"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
);

export { Progress };
