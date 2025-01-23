import { cn } from '@/lib/utils';
import { FC, RefAttributes, TextareaHTMLAttributes } from 'react';

const Textarea: FC<
  TextareaHTMLAttributes<HTMLTextAreaElement> &
    RefAttributes<HTMLTextAreaElement>
> = ({ className, ...props }) => (
  <textarea
    className={cn(
      'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
);

export { Textarea };
