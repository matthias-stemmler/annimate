import { State, StoreContext, createStoreForContext } from '@/lib/store';
import { FC, PropsWithChildren, useRef } from 'react';
import { StoreApi } from 'zustand';

export const StoreProvider: FC<PropsWithChildren> = ({ children }) => {
  const storeRef = useRef<StoreApi<State>>();
  if (storeRef.current === undefined) {
    storeRef.current = createStoreForContext();
  }

  return <StoreContext.Provider value={storeRef.current} children={children} />;
};
