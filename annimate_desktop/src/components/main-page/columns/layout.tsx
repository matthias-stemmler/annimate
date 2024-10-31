import { cn } from '@/lib/utils';
import { FC, PropsWithChildren } from 'react';

export const ColumnConfigGrid: FC<PropsWithChildren> = ({ children }) => (
  <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-6">{children}</div>
);

export type ColumnConfigItemProps = PropsWithChildren<{
  wide?: boolean;
}>;

export const ColumnConfigItem: FC<ColumnConfigItemProps> = ({
  children,
  wide = false,
}) => (
  <div className={cn('flex flex-col gap-2', { 'col-span-2': wide })}>
    {children}
  </div>
);
