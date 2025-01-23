import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { FC, HTMLAttributes, RefAttributes } from 'react';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive:
          'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const Alert: FC<
  HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof alertVariants> &
    RefAttributes<HTMLDivElement>
> = ({ className, variant, ...props }) => (
  <div
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
);

const AlertTitle: FC<
  HTMLAttributes<HTMLHeadingElement> & RefAttributes<HTMLHeadingElement>
> = ({ className, ...props }) => (
  <h5
    className={cn('mb-1 leading-none font-medium tracking-tight', className)}
    {...props}
  />
);

const AlertDescription: FC<
  HTMLAttributes<HTMLParagraphElement> & RefAttributes<HTMLParagraphElement>
> = ({ className, ...props }) => (
  <div className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
);

export { Alert, AlertDescription, AlertTitle };
