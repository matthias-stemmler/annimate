import { cn } from '@/lib/utils';
import { FC, HTMLAttributes, RefAttributes } from 'react';

const Card: FC<
  HTMLAttributes<HTMLDivElement> & RefAttributes<HTMLDivElement>
> = ({ className, ...props }) => (
  <div
    className={cn(
      'rounded-lg border bg-card text-card-foreground shadow-sm',
      className,
    )}
    {...props}
  />
);

const CardHeader: FC<
  HTMLAttributes<HTMLDivElement> & RefAttributes<HTMLDivElement>
> = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
);

const CardTitle: FC<
  HTMLAttributes<HTMLHeadingElement> & RefAttributes<HTMLHeadingElement>
> = ({ className, ...props }) => (
  <h3
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight',
      className,
    )}
    {...props}
  />
);

const CardDescription: FC<
  HTMLAttributes<HTMLParagraphElement> & RefAttributes<HTMLParagraphElement>
> = ({ className, ...props }) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...props} />
);

const CardContent: FC<
  HTMLAttributes<HTMLDivElement> & RefAttributes<HTMLDivElement>
> = ({ className, ...props }) => (
  <div className={cn('p-6 pt-0', className)} {...props} />
);

const CardFooter: FC<
  HTMLAttributes<HTMLDivElement> & RefAttributes<HTMLDivElement>
> = ({ className, ...props }) => (
  <div className={cn('flex items-center p-6 pt-0', className)} {...props} />
);

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
