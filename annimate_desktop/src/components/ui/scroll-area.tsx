import { cn } from '@/lib/utils';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { ComponentProps, FC, Ref, UIEventHandler } from 'react';

const ScrollArea: FC<
  ComponentProps<typeof ScrollAreaPrimitive.Root> & {
    focusable?: boolean;
    onScroll?: UIEventHandler<HTMLDivElement>;
    orientation?:
      | ComponentProps<
          typeof ScrollAreaPrimitive.ScrollAreaScrollbar
        >['orientation']
      | 'both';
    viewportRef?: Ref<HTMLDivElement>;
  }
> = ({
  className,
  children,
  focusable = false,
  onScroll,
  orientation = 'vertical',
  viewportRef,
  ...props
}) => (
  <ScrollAreaPrimitive.Root
    className={cn(
      'relative overflow-hidden',
      focusable &&
        'has-focus-visible:ring-ring has-focus-visible:ring has-focus-visible:ring-offset-1',
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport
      ref={viewportRef}
      className="h-full w-full rounded-[inherit] focus-visible:outline-hidden"
      onScroll={onScroll}
      tabIndex={focusable ? 0 : undefined}
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    {(orientation === 'horizontal' || orientation === 'both') && (
      <ScrollBar orientation="horizontal" />
    )}
    {(orientation === 'vertical' || orientation === 'both') && (
      <ScrollBar orientation="vertical" />
    )}
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
);

const ScrollBar: FC<
  ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
> = ({ className, orientation = 'vertical', ...props }) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    orientation={orientation}
    className={cn(
      'flex touch-none transition-colors select-none',
      orientation === 'vertical' &&
        'h-full w-2.5 border-l border-l-transparent p-px',
      orientation === 'horizontal' &&
        'h-2.5 flex-col border-t border-t-transparent p-px',
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-slate-300 dark:bg-slate-600" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
);

export { ScrollArea, ScrollBar };
