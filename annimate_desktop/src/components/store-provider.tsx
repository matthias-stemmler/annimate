import { State, StoreContext, createStoreForContext } from '@/lib/store';
import { FC, PropsWithChildren, useRef } from 'react';
import { StoreApi } from 'zustand';

export const StoreProvider: FC<PropsWithChildren> = ({ children }) => {
  const storeRef = useRef<StoreApi<State>>(null);
  if (storeRef.current === null) {
    storeRef.current = createStoreForContext();
  }

  return <StoreContext value={storeRef.current} children={children} />;
};
