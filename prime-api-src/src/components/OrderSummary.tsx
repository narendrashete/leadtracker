import { Card } from './ui';
import { inr } from '../lib';

export function OrderSummary({ lines, shipping, courierName, children }: { lines: { name: string; qty: number; price: number; emoji: string }[]; shipping: number | null; courierName?: string; children?: any }) {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  return (
    <Card className="lg:sticky lg:top-24">
      <h3 className="mb-3 text-lg font-extrabold">Order Summary</h3>
      <ul className="space-y-2 text-sm">
        {lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-3"><span>{l.emoji} {l.name} <span className="text-slate-400">× {l.qty}</span></span><span className="font-semibold">{inr(l.price * l.qty)}</span></li>
        ))}
      </ul>
      <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Product subtotal</span><span className="font-semibold">{inr(subtotal)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Shipping{courierName ? ` (${courierName})` : ''}</span><span className="font-semibold">{shipping === null ? 'Select courier next' : inr(shipping)}</span></div>
        <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-extrabold"><span>Grand total</span><span>{inr(subtotal + (shipping || 0))}</span></div>
      </div>
      {children}
    </Card>
  );
}
