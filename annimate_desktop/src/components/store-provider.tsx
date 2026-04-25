import { StoreContext, createStoreContextValue } from '@/lib/store';
import { FC, PropsWithChildren, useState } from 'react';

export const StoreProvider: FC<PropsWithChildren> = ({ children }) => {
  const [value] = useState(createStoreContextValue);
  return <StoreContext value={value} children={children} />;
};
