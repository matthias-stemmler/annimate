import { FC, PropsWithChildren, ReactNode } from 'react';

export const ColumnConfigGrid: FC<PropsWithChildren> = ({ children }) => (
  <div className="grid grid-cols-2 gap-4 mb-2">{children}</div>
);

export type ColumnConfigItemProps = {
  caption: ReactNode;
};

export const ColumnConfigItem: FC<PropsWithChildren<ColumnConfigItemProps>> = ({
  caption,
  children,
}) => (
  <div>
    <p className="text-sm mb-1">{caption}</p>
    {children}
  </div>
);
