import { Badge, Btn, Stars } from './ui';
import { useApp } from '../context';
import { inr } from '../lib';
import type { Product } from '../types';

export function ProductCard({ p }: { p: Product }) {
  const { cart, setCart, toast } = useApp();
  const inCart = cart.find(c => c.id === p.id)?.qty || 0;
  const add = () => {
    if (inCart >= p.stock) return toast('Only ' + p.stock + ' units available', 'err');
    setCart(c => (c.find(x => x.id === p.id) ? c.map(x => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x)) : [...c, { id: p.id, qty: 1 }]));
    toast(p.name + ' added to cart');
  };
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative grid h-44 place-items-center text-6xl" style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}>
        <span className="transition group-hover:scale-110">{p.emoji}</span>
        <span className="absolute left-3 top-3"><Badge color="slate">{p.category}</Badge></span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold">{p.name}</h3>
        <Stars r={p.rating} />
        <div className="flex items-center justify-between">
          <span className="text-lg font-extrabold">{inr(p.price)}</span>
          {p.stock === 0 ? <Badge color="rose">Out of stock</Badge> : p.stock <= 5 ? <Badge color="amber">Only {p.stock} left</Badge> : <Badge color="green">In stock</Badge>}
        </div>
        <Btn className="mt-auto" disabled={p.stock === 0} onClick={add}>{p.stock === 0 ? 'Unavailable' : inCart ? `Add More (${inCart} in cart)` : 'Add to Cart'}</Btn>
      </div>
    </div>
  );
}
