import { FC, PropsWithChildren } from 'react';

export const ColumnConfigGrid: FC<PropsWithChildren> = ({ children }) => (
  <div className="grid grid-cols-2 gap-4 mb-2">{children}</div>
);

export const ColumnConfigItem: FC<PropsWithChildren> = ({ children }) => (
  <div className="flex flex-col gap-2">{children}</div>
);
