import { cn } from '@/lib/utils';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { ComponentProps, FC } from 'react';

const Tabs = TabsPrimitive.Root;

const TabsList: FC<ComponentProps<typeof TabsPrimitive.List>> = ({
  className,
  ...props
}) => (
  <TabsPrimitive.List
    className={cn(
      'bg-muted text-muted-foreground inline-flex h-10 items-center justify-center rounded-md p-1',
      className,
    )}
    {...props}
  />
);

const TabsTrigger: FC<ComponentProps<typeof TabsPrimitive.Trigger>> = ({
  className,
  ...props
}) => (
  <TabsPrimitive.Trigger
    className={cn(
      'ring-offset-background focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-xs',
      className,
    )}
    {...props}
  />
);

const TabsContent: FC<ComponentProps<typeof TabsPrimitive.Content>> = ({
  className,
  ...props
}) => (
  <TabsPrimitive.Content
    className={cn(
      'ring-offset-background focus-visible:ring-ring mt-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
      className,
    )}
    {...props}
  />
);

export { Tabs, TabsContent, TabsList, TabsTrigger };
