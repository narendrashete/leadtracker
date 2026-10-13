import { Btn, Card, Empty, Title } from '../components/ui';
import { useApp } from '../context';
import { go, inr, productById } from '../lib';

export function Cart() {
  const { cart, setCart, toast } = useApp();
  const lines = cart.map(c => ({ ...c, p: productById(c.id) }));
  const items = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.p.price, 0);
  const setQty = (id: number, qty: number, max: number) => {
    if (qty < 1) return;
    if (qty > max) return toast('Only ' + max + ' units in stock', 'err');
    setCart(c => c.map(x => (x.id === id ? { ...x, qty } : x)));
  };
  if (!lines.length) return <><Title>My Cart</Title><Empty icon="🛒" title="Your cart is empty" text="Add a few products to start the shipping demo." action={<Btn onClick={() => go('/products')}>Browse products</Btn>} /></>;
  return (
    <>
      <Title sub={`${items} item${items > 1 ? 's' : ''} in your cart`}>Shopping Cart</Title>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {lines.map(l => (
            <Card key={l.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl text-4xl" style={{ background: `linear-gradient(135deg, ${l.p.from}, ${l.p.to})` }}>{l.p.emoji}</div>
              <div className="flex-1">
                <h3 className="font-bold">{l.p.name}</h3>
                <p className="text-sm text-slate-500">Unit price {inr(l.p.price)}</p>
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-slate-200">
                <button className="h-9 w-9 text-lg font-bold hover:bg-slate-50" onClick={() => setQty(l.id, l.qty - 1, l.p.stock)}>−</button>
                <span className="w-8 text-center font-bold">{l.qty}</span>
                <button className="h-9 w-9 text-lg font-bold hover:bg-slate-50" onClick={() => setQty(l.id, l.qty + 1, l.p.stock)}>+</button>
              </div>
              <div className="w-24 text-right font-extrabold">{inr(l.qty * l.p.price)}</div>
              <Btn kind="danger" onClick={() => { setCart(c => c.filter(x => x.id !== l.id)); toast('Removed ' + l.p.name); }}>🗑 Remove</Btn>
            </Card>
          ))}
        </div>
        <Card className="h-fit">
          <h3 className="mb-3 text-lg font-extrabold">Cart Total</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Total items</span><b>{items}</b></div>
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><b>{inr(total)}</b></div>
            <div className="flex justify-between"><span className="text-slate-500">Shipping</span><span className="text-slate-400">Chosen at checkout</span></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-lg font-extrabold"><span>Total</span><span>{inr(total)}</span></div>
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <Btn onClick={() => go('/checkout')}>Proceed to Checkout</Btn>
            <Btn kind="ghost" onClick={() => go('/products')}>Continue Shopping</Btn>
          </div>
        </Card>
      </div>
    </>
  );
}
