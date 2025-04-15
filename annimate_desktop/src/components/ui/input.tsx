import { cn } from '@/lib/utils';
import { FC, InputHTMLAttributes, RefAttributes } from 'react';

const Input: FC<
  InputHTMLAttributes<HTMLInputElement> & RefAttributes<HTMLInputElement>
> = ({ className, type, ...props }) => {
  return (
    <input
      type={type}
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      className={cn(
        'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring focus-visible:ring-offset-1 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      spellCheck={false}
      {...props}
    />
  );
};

export { Input };
