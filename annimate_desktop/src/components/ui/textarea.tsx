import { cn } from '@/lib/utils';
import { FC, RefAttributes, TextareaHTMLAttributes } from 'react';

const Textarea: FC<
  TextareaHTMLAttributes<HTMLTextAreaElement> &
    RefAttributes<HTMLTextAreaElement>
> = ({ className, ...props }) => (
  <textarea
    autoCapitalize="off"
    autoComplete="off"
    autoCorrect="off"
    className={cn(
      'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring focus-visible:ring-offset-1 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    spellCheck={false}
    {...props}
  />
);

export { Textarea };
