import { cn } from '@/lib/utils';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { ComponentProps, FC } from 'react';

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
);

const Label: FC<
  ComponentProps<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
> = ({ className, ...props }) => (
  <LabelPrimitive.Root className={cn(labelVariants(), className)} {...props} />
);

export { Label };
