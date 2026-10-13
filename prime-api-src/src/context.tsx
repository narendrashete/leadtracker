import { createContext, useContext } from 'react';
import type { CartLine, Draft, Order } from './types';

export type Ctx = {
  cart: CartLine[]; setCart: (f: (c: CartLine[]) => CartLine[]) => void;
  orders: Order[]; setOrders: (f: (o: Order[]) => Order[]) => void;
  draft: Draft | null; setDraft: (d: Draft | null) => void;
  toast: (msg: string, type?: 'ok' | 'err') => void;
};

export const AppCtx = createContext<Ctx>(null as any);

export const useApp = () => useContext(AppCtx);
