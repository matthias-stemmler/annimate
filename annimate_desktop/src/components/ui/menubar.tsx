import * as MenubarPrimitive from '@radix-ui/react-menubar';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ComponentProps, FC, HTMLAttributes, RefAttributes } from 'react';

const MenubarMenu = MenubarPrimitive.Menu;

const MenubarGroup = MenubarPrimitive.Group;

const MenubarPortal = MenubarPrimitive.Portal;

const MenubarSub = MenubarPrimitive.Sub;

const MenubarRadioGroup = MenubarPrimitive.RadioGroup;

const Menubar: FC<ComponentProps<typeof MenubarPrimitive.Root>> = ({
  className,
  ...props
}) => (
  <MenubarPrimitive.Root
    className={cn(
      'bg-background flex h-10 items-center space-x-1 border-b p-1',
      className,
    )}
    {...props}
  />
);

const MenubarTrigger: FC<ComponentProps<typeof MenubarPrimitive.Trigger>> = ({
  className,
  ...props
}) => (
  <MenubarPrimitive.Trigger
    className={cn(
      'focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-hidden select-none',
      className,
    )}
    {...props}
  />
);

const MenubarSubTrigger: FC<
  ComponentProps<typeof MenubarPrimitive.SubTrigger> & { inset?: boolean }
> = ({ className, inset, children, ...props }) => (
  <MenubarPrimitive.SubTrigger
    className={cn(
      'focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none',
      inset && 'pl-8',
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto size-4" />
  </MenubarPrimitive.SubTrigger>
);

const MenubarSubContent: FC<
  ComponentProps<typeof MenubarPrimitive.SubContent>
> = ({ className, ...props }) => (
  <MenubarPrimitive.SubContent
    className={cn(
      'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-md border p-1',
      className,
    )}
    {...props}
  />
);

const MenubarContent: FC<ComponentProps<typeof MenubarPrimitive.Content>> = ({
  className,
  align = 'start',
  alignOffset = -4,
  sideOffset = 8,
  ...props
}) => (
  <MenubarPrimitive.Portal>
    <MenubarPrimitive.Content
      align={align}
      alignOffset={alignOffset}
      sideOffset={sideOffset}
      className={cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[12rem] overflow-hidden rounded-md border p-1 shadow-md',
        className,
      )}
      {...props}
    />
  </MenubarPrimitive.Portal>
);

const MenubarItem: FC<
  ComponentProps<typeof MenubarPrimitive.Item> & {
    inset?: boolean;
  }
> = ({ className, inset, ...props }) => (
  <MenubarPrimitive.Item
    className={cn(
      'focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
);

const MenubarCheckboxItem: FC<
  ComponentProps<typeof MenubarPrimitive.CheckboxItem>
> = ({ className, children, checked, ...props }) => (
  <MenubarPrimitive.CheckboxItem
    className={cn(
      'focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Check className="size-4" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.CheckboxItem>
);

const MenubarRadioItem: FC<
  ComponentProps<typeof MenubarPrimitive.RadioItem>
> = ({ className, children, ...props }) => (
  <MenubarPrimitive.RadioItem
    className={cn(
      'focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Circle className="size-2 fill-current" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}
  </MenubarPrimitive.RadioItem>
);

const MenubarLabel: FC<
  ComponentProps<typeof MenubarPrimitive.Label> & { inset?: boolean }
> = ({ className, inset, ...props }) => (
  <MenubarPrimitive.Label
    className={cn(
      'px-2 py-1.5 text-sm font-semibold',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
);

const MenubarSeparator: FC<
  ComponentProps<typeof MenubarPrimitive.Separator>
> = ({ className, ...props }) => (
  <MenubarPrimitive.Separator
    className={cn('bg-muted -mx-1 my-1 h-px', className)}
    {...props}
  />
);

const MenubarShortcut: FC<
  HTMLAttributes<HTMLSpanElement> & RefAttributes<HTMLSpanElement>
> = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      'text-muted-foreground ml-auto text-xs tracking-widest',
      className,
    )}
    {...props}
  />
);

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
};
