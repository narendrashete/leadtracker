import { useState } from 'react';
import { OrderSummary } from '../components/OrderSummary';
import { Btn, Card, Empty, Spinner, Title } from '../components/ui';
import { useApp } from '../context';
import { emptyCustomer, go, productById, sleep, uid } from '../lib';
import type { Customer } from '../types';

export function useCartLines() {
  const { cart } = useApp();
  return cart.map(c => { const p = productById(c.id); return { id: p.id, name: p.name, price: p.price, qty: c.qty, emoji: p.emoji }; });
}

export function Field({ label, error, children }: any) {
  return <label className="block text-sm font-semibold">{label}{children}{error && <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span>}</label>;
}

export function Checkout() {
  const { cart, draft, setDraft, toast } = useApp();
  const lines = useCartLines();
  const [f, setF] = useState<Customer>(draft?.customer || emptyCustomer);
  const [err, setErr] = useState<Partial<Record<keyof Customer, string>>>({});
  const [busy, setBusy] = useState(false);
  if (!cart.length) return <><Title>Checkout</Title><Empty icon="🛒" title="Your cart is empty" text="Add products before checking out." action={<Btn onClick={() => go('/products')}>Browse products</Btn>} /></>;
  const set = (k: keyof Customer) => (e: any) => setF({ ...f, [k]: e.target.value });
  const inp = (k: keyof Customer) => 'mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-indigo-100 ' + (err[k] ? 'border-rose-400' : 'border-slate-200 focus:border-brand');
  const submit = async (e: any) => {
    e.preventDefault();
    const x: any = {};
    if (!f.name.trim()) x.name = 'Full name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) x.email = 'Enter a valid email address';
    if (!/^[6-9]\d{9}$/.test(f.mobile)) x.mobile = 'Enter a valid 10-digit mobile number';
    if (!f.address.trim()) x.address = 'Address is required';
    if (!f.city.trim()) x.city = 'City is required';
    if (!f.state.trim()) x.state = 'State is required';
    if (!/^\d{6}$/.test(f.pin)) x.pin = 'Enter a valid 6-digit PIN code';
    setErr(x);
    if (Object.keys(x).length) return toast('Please fix the highlighted fields', 'err');
    setBusy(true); await sleep(700);
    setDraft({ id: draft?.id || uid(), customer: f });
    go('/shipping');
  };
  return (
    <>
      <Title sub="Step 1 of 3 · Delivery details">Checkout</Title>
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3" noValidate>
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className="mb-4 text-lg font-extrabold">Customer details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Full name *" error={err.name}><input className={inp('name')} value={f.name} onChange={set('name')} placeholder="Aarav Sharma" /></Field></div>
              <Field label="Email address *" error={err.email}><input className={inp('email')} value={f.email} onChange={set('email')} placeholder="aarav@example.com" /></Field>
              <Field label="Mobile number *" error={err.mobile}><input className={inp('mobile')} value={f.mobile} onChange={set('mobile')} placeholder="9876543210" maxLength={10} /></Field>
            </div>
          </Card>
          <Card>
            <h3 className="mb-4 text-lg font-extrabold">Delivery address</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Address line *" error={err.address}><input className={inp('address')} value={f.address} onChange={set('address')} placeholder="Flat 12, MG Road" /></Field></div>
              <Field label="City *" error={err.city}><input className={inp('city')} value={f.city} onChange={set('city')} placeholder="Pune" /></Field>
              <Field label="State *" error={err.state}><input className={inp('state')} value={f.state} onChange={set('state')} placeholder="Maharashtra" /></Field>
              <Field label="PIN code *" error={err.pin}><input className={inp('pin')} value={f.pin} onChange={set('pin')} placeholder="411001" maxLength={6} /></Field>
            </div>
            <button type="button" className="mt-3 text-xs font-semibold text-brand hover:underline" onClick={() => { setF({ name: 'Aarav Sharma', email: 'aarav@example.com', mobile: '9876543210', address: 'Flat 12, MG Road', city: 'Pune', state: 'Maharashtra', pin: '411001' }); setErr({}); }}>Fill with sample details</button>
          </Card>
        </div>
        <OrderSummary lines={lines} shipping={null}>
          <div className="mt-5 flex flex-col gap-2">
            <Btn type="submit" disabled={busy}>{busy ? <><Spinner /> Checking…</> : 'Continue to Shipping Options'}</Btn>
            <Btn kind="ghost" onClick={() => go('/cart')}>Back to cart</Btn>
          </div>
        </OrderSummary>
      </form>
    </>
  );
}
