import { useState, useEffect } from 'react';
import { StatusBadge, Timeline } from '../components/Timeline';
import { Btn, Card, CourierLogo, DemoTag, Empty, Spinner, Title } from '../components/ui';
import { useApp } from '../context';
import { STAGES } from '../data';
import { DAY, eventTime, fmtDate, go, sleep } from '../lib';

export function Track({ initial }: { initial: string }) {
  const { orders, setOrders, toast } = useApp();
  const [input, setInput] = useState(initial);
  const [awb, setAwb] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [sim, setSim] = useState(false);
  useEffect(() => { setInput(initial); setAwb(initial); }, [initial]);
  const order = awb ? orders.find(o => o.awb === awb.trim().toUpperCase()) : undefined;

  const search = async (e?: any) => {
    e?.preventDefault();
    const v = input.trim().toUpperCase();
    if (!v) return toast('Enter an AWB number', 'err');
    setLoading(true); setAwb(''); await sleep(700);
    setAwb(v); setLoading(false);
  };
  const simulate = async () => {
    if (!order || sim || order.progress >= 8) return;
    setSim(true); await sleep(600);
    setOrders(os => os.map(o => (o.awb === order.awb && o.progress < 8 ? { ...o, progress: o.progress + 1 } : o)));
    const next = order.progress + 1;
    toast(next >= 8 ? 'Parcel delivered 🎉' : 'Update: ' + STAGES[next - 1].label);
    setSim(false);
  };
  return (
    <>
      <Title sub="Enter the AWB number from your order confirmation">Track Shipment</Title>
      <Card className="mb-6">
        <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="e.g. GTI7845632190" className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm uppercase outline-none focus:border-brand focus:ring-2 focus:ring-indigo-100" />
          <Btn type="submit" disabled={loading}>{loading ? <><Spinner /> Searching…</> : 'Track Shipment'}</Btn>
        </form>
        {orders.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">Your demo AWBs:
            {orders.map(o => <button key={o.awb} onClick={() => { setInput(o.awb); setAwb(o.awb); }} className="rounded-full bg-slate-100 px-3 py-1 font-mono font-semibold text-navy hover:bg-indigo-50">{o.awb}</button>)}
          </div>
        )}
      </Card>

      {loading && <Card className="py-12 text-center text-slate-500"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-brand" />Fetching tracking details…</Card>}

      {!loading && awb && !order && (
        <Card className="border-rose-200 bg-rose-50 text-center">
          <div className="text-4xl">🚫</div>
          <h3 className="mt-2 text-lg font-extrabold text-rose-700">AWB not found</h3>
          <p className="text-sm text-rose-600">No shipment matches “{awb}”. Only AWB numbers generated in this demo can be tracked — check the number and try again.</p>
        </Card>
      )}

      {!loading && !awb && <Empty icon="📍" title="Track your parcel" text={orders.length ? 'Enter an AWB or pick one of your demo AWBs above.' : 'Place a demo order first to get an AWB number to track.'} action={orders.length ? null : <Btn onClick={() => go('/products')}>Start shopping</Btn>} />}

      {!loading && order && (
        <div className="grid gap-6 lg:grid-cols-3 pop">
          <Card className="h-fit">
            <div className="mb-3 flex items-center justify-between"><CourierLogo c={order.courier} /><DemoTag /></div>
            <dl className="space-y-2.5 text-sm">
              {([['AWB number', <span className="font-mono">{order.awb}</span>], ['Courier partner', `${order.courier.name} · ${order.courier.service}`], ['Order number', <a className="text-brand hover:underline" href={'#/orders/' + order.orderNo}>{order.orderNo}</a>],
                ['Booking date', fmtDate(order.createdAt)], ['Estimated delivery', fmtDate(order.createdAt + order.courier.days * DAY)], ['Current status', <StatusBadge o={order} />], ['Destination', `${order.customer.city} – ${order.customer.pin}`]] as [string, any][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-right font-bold">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-slate-400">Simulated tracking events — not a real courier shipment.</p>
          </Card>
          <Card className="lg:col-span-2">
            <h3 className="mb-5 text-lg font-extrabold">Shipment progress</h3>
            {order.progress >= 8 && <div className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">🎉 Delivered on {fmtDate(eventTime(order, 7))} — thank you for shopping with us!</div>}
            <Timeline order={order} onSimulate={simulate} />
            {sim && <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-200 border-t-brand" /> Receiving courier update…</p>}
          </Card>
        </div>
      )}
    </>
  );
}
