import { useState, useRef } from 'react';
import { OrderSummary } from '../components/OrderSummary';
import { Badge, Btn, Card, CourierLogo, DemoTag, Empty, Spinner, Title } from '../components/ui';
import { useApp } from '../context';
import { buildCouriers, go, inr, sleep } from '../lib';
import { useCartLines } from './Checkout';
import type { Order } from '../types';

export function Shipping() {
  const { cart, draft, setCart, setDraft, orders, setOrders, toast } = useApp();
  const lines = useCartLines();
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  if (!cart.length) return <><Title>Compare Shipping Partners</Title><Empty icon="🛒" title="Your cart is empty" text="Add products before choosing a courier." action={<Btn onClick={() => go('/products')}>Browse products</Btn>} /></>;
  if (!draft) return <><Title>Compare Shipping Partners</Title><Empty icon="📍" title="Delivery details missing" text="Enter your delivery address first." action={<Btn onClick={() => go('/checkout')}>Go to checkout</Btn>} /></>;
  const qty = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const couriers = buildCouriers(qty, draft.customer.pin);
  const ok = couriers.filter(c => c.serviceable);
  const cheapest = ok.reduce((a, b) => (b.price < a.price ? b : a));
  const fastest = ok.reduce((a, b) => (b.days < a.days ? b : a));
  const chosen = couriers.find(c => c.code === sel) || null;

  const confirm = async () => {
    if (lock.current || !chosen) return;      // blocks double-click
    lock.current = true; setBusy(true);
    await sleep(1600);
    const dup = orders.find(o => o.draftId === draft.id);   // same checkout never makes two orders
    let orderNo: string;
    if (dup) { orderNo = dup.orderNo; }
    else {
      const maxNo = orders.reduce((m, o) => Math.max(m, parseInt(o.orderNo.split('-')[2], 10)), 10024);
      orderNo = `ORD-${new Date().getFullYear()}-${maxNo + 1}`;
      let awb = '';
      do { awb = chosen.prefix + String(Math.floor(1e9 + Math.random() * 9e9)); } while (orders.some(o => o.awb === awb));
      const order: Order = {
        orderNo, draftId: draft.id, awb, createdAt: Date.now(), items: lines, customer: draft.customer,
        courier: chosen, subtotal, shipping: chosen.price, total: subtotal + chosen.price, progress: 2,
      };
      setOrders(o => (o.some(x => x.draftId === draft.id) ? o : [order, ...o]));
    }
    setCart(() => []); setDraft(null);
    toast('Shipment booked with ' + chosen.name);
    go('/confirmation/' + orderNo);
  };

  return (
    <>
      <Title sub="Step 2 of 3 · Choose how your parcel travels">Compare Shipping Partners</Title>
      <div className="mb-3"><DemoTag text="Demo estimates — not live quotations" /></div>
      <Card className="mb-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
        {[['Product subtotal', inr(subtotal)], ['Items / packages', `${qty} item${qty > 1 ? 's' : ''} · 1 package`], ['Delivery PIN', draft.customer.pin], ['Cheapest', `${cheapest.name} (${inr(cheapest.price)})`], ['Fastest', `${fastest.name} (${fastest.tat})`]].map(([k, v]) => (
          <div key={k}><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</div><div className="mt-0.5 font-extrabold">{v}</div></div>
        ))}
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {couriers.map(c => {
            const picked = sel === c.code;
            return (
              <div key={c.code} className={'rounded-2xl border-2 bg-white p-5 shadow-sm transition ' + (picked ? 'border-brand ring-4 ring-indigo-100' : 'border-slate-100 hover:border-indigo-200') + (c.serviceable ? '' : ' opacity-60')}>
                <div className="flex flex-wrap items-center gap-4">
                  <CourierLogo c={c} />
                  <div className="min-w-[140px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-extrabold">{c.name}</h3>
                      {c.serviceable && c.code === cheapest.code && <Badge color="green">Lowest Price</Badge>}
                      {c.serviceable && c.code === fastest.code && <Badge color="violet">Fastest Delivery</Badge>}
                    </div>
                    <p className="text-sm text-slate-500">{c.service} service · {c.serviceable ? <span className="font-semibold text-emerald-600">Serviceable at {draft.customer.pin}</span> : <span className="font-semibold text-rose-600">Not serviceable at {draft.customer.pin}</span>}</p>
                  </div>
                  <div className="text-right"><div className="text-2xl font-black">{inr(c.price)}</div><div className="text-xs text-slate-400">shipping charge</div></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
                  <div><div className="text-xs text-slate-400">TAT</div><b>{c.tat}</b></div>
                  <div><div className="text-xs text-slate-400">Estimated delivery</div><b>{c.est}</b></div>
                  <div className="col-span-2 sm:col-span-1 sm:text-right">
                    <Btn kind={picked ? 'primary' : 'ghost'} disabled={!c.serviceable || busy} onClick={() => { setSel(c.code); }}>{picked ? '✓ Selected' : 'Select Courier'}</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <OrderSummary lines={lines} shipping={chosen ? chosen.price : null} courierName={chosen?.name}>
          {chosen && <p className="mt-3 rounded-lg bg-indigo-50 p-2 text-xs text-brand">Est. delivery by <b>{chosen.est}</b> via {chosen.name} ({chosen.service})</p>}
          <div className="mt-5 flex flex-col gap-2">
            <Btn disabled={!chosen || busy} onClick={confirm}>{busy ? <><Spinner /> Booking shipment…</> : 'Confirm Shipment'}</Btn>
            <Btn kind="ghost" disabled={busy} onClick={() => go('/checkout')}>Edit address</Btn>
          </div>
        </OrderSummary>
      </div>
    </>
  );
}
