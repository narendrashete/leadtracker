import { useState, useEffect } from 'react';
import { COURIERS, PRODUCTS, STAGES } from './data';
import type { Courier, Customer, Order } from './types';

export const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

export const fmtDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const fmtTime = (t: number) => new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export const DAY = 86400000;

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const uid = () => Math.random().toString(36).slice(2, 10);

export const productById = (id: number) => PRODUCTS.find(p => p.id === id)!;

export const statusOf = (o: Order) => (o.progress >= 8 ? 'Delivered' : STAGES[o.progress - 1].label);

export const eventTime = (o: Order, i: number) => o.createdAt + STAGES[i].at * o.courier.days * DAY;

export const emptyCustomer: Customer = { name: '', email: '', mobile: '', address: '', city: '', state: '', pin: '' };

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [val, setVal] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [key, val]);
  return [val, setVal as any];
}

export function useRoute() {
  const read = () => {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, q] = h.split('?');
    return { path, query: new URLSearchParams(q || '') };
  };
  const [r, setR] = useState(read);
  useEffect(() => {
    const f = () => { setR(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}

export const go = (p: string) => { location.hash = p; };

export function buildCouriers(qty: number, pin: string): Courier[] {
  const now = Date.now();
  return COURIERS.map(c => ({
    code: c.code, name: c.name, prefix: c.prefix, color: c.color, tat: c.tat, days: c.days, service: c.service,
    price: c.base + c.per * qty,
    est: fmtDate(now + c.days * DAY),
    serviceable: !(c.code === 'XPB' && pin.startsWith('9')),
  }));
}
