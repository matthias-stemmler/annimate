import {
  ClientStateContext,
  useClientStateContextValue,
} from '@/lib/client-state-context';
import { FC, PropsWithChildren } from 'react';

export const ClientStateContextProvider: FC<PropsWithChildren> = ({
  children,
}) => (
  <ClientStateContext.Provider
    children={children}
    value={useClientStateContextValue()}
  />
);
