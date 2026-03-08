import { FC, PropsWithChildren } from 'react';

export const ColumnConfigGrid: FC<PropsWithChildren> = ({ children }) => (
  <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-6">{children}</div>
);

export const ColumnConfigItem: FC<PropsWithChildren> = ({ children }) => (
  <div className="flex flex-col gap-2">{children}</div>
);
