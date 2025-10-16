import { StoreContext, createStoreForContext } from '@/lib/store';
import { FC, PropsWithChildren, useState } from 'react';

export const StoreProvider: FC<PropsWithChildren> = ({ children }) => {
  const [store] = useState(createStoreForContext);
  return <StoreContext value={store} children={children} />;
};
