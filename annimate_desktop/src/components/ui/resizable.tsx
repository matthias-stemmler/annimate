import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import { ComponentProps, FC } from 'react';
import * as ResizablePrimitive from 'react-resizable-panels';

const ResizableGroup: FC<ComponentProps<typeof ResizablePrimitive.Group>> = ({
  className,
  ...props
}: ComponentProps<typeof ResizablePrimitive.Group>) => (
  <ResizablePrimitive.Group
    className={cn(
      'flex size-full aria-[orientation=vertical]:flex-col',
      className,
    )}
    {...props}
  />
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableSeparator: FC<
  ComponentProps<typeof ResizablePrimitive.Separator> & {
    withHandle?: boolean;
  }
> = ({ withHandle, className, ...props }) => (
  <ResizablePrimitive.Separator
    className={cn(
      'bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90',
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-sm border">
        <GripVertical className="size-2.5" />
      </div>
    )}
  </ResizablePrimitive.Separator>
);

export { ResizableGroup, ResizablePanel, ResizableSeparator };
