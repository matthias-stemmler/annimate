import { cn } from '@/lib/utils';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { ComponentProps, FC, ReactElement } from 'react';

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport: FC<ComponentProps<typeof ToastPrimitives.Viewport>> = ({
  className,
  ...props
}) => (
  <ToastPrimitives.Viewport
    className={cn(
      'fixed top-0 z-40 flex max-h-screen w-full flex-col-reverse p-6 outline-hidden sm:top-auto sm:right-0 sm:bottom-0 sm:flex-col md:max-w-[420px]',
      className,
    )}
    {...props}
  />
);

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg focus:outline-hidden focus:ring focus:ring-ring focus:ring-offset-1 transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x) data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full sm:data-[state=open]:slide-in-from-bottom-full mt-1',
  {
    variants: {
      variant: {
        default: 'border bg-background text-foreground',
        destructive:
          'destructive group border-destructive bg-destructive text-destructive-foreground',
        success: 'bg-green-100 dark:bg-green-900',
        warning: 'bg-yellow-100 dark:bg-yellow-900',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const Toast: FC<
  ComponentProps<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
> = ({ className, variant, ...props }) => (
  <ToastPrimitives.Root
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
);

const ToastAction: FC<ComponentProps<typeof ToastPrimitives.Action>> = ({
  className,
  ...props
}) => (
  <ToastPrimitives.Action
    className={cn(
      'ring-offset-background hover:bg-secondary focus:ring-ring group-[.destructive]:border-muted/40 hover:group-[.destructive]:border-destructive/30 hover:group-[.destructive]:bg-destructive hover:group-[.destructive]:text-destructive-foreground focus:group-[.destructive]:ring-destructive inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors focus:ring focus:ring-offset-1 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    {...props}
  />
);

const ToastClose: FC<ComponentProps<typeof ToastPrimitives.Close>> = ({
  className,
  ...props
}) => (
  <ToastPrimitives.Close
    className={cn(
      'text-foreground/50 hover:text-foreground focus:ring-ring absolute top-2 right-2 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 group-[.destructive]:text-red-300 hover:group-[.destructive]:text-red-50 focus:opacity-100 focus:ring focus:outline-hidden focus:group-[.destructive]:ring-red-400 focus:group-[.destructive]:ring-offset-red-600',
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="size-4" />
  </ToastPrimitives.Close>
);

const ToastTitle: FC<ComponentProps<typeof ToastPrimitives.Title>> = ({
  className,
  ...props
}) => (
  <ToastPrimitives.Title
    className={cn('text-sm font-semibold', className)}
    {...props}
  />
);

const ToastDescription: FC<
  ComponentProps<typeof ToastPrimitives.Description>
> = ({ className, ...props }) => (
  <ToastPrimitives.Description
    className={cn('text-sm opacity-90', className)}
    {...props}
  />
);

type ToastProps = ComponentProps<typeof Toast>;

type ToastActionElement = ReactElement<typeof ToastAction>;

export {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastActionElement,
  type ToastProps,
};
