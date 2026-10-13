import { StatusBadge, Timeline } from '../components/Timeline';
import { Btn, Card, CourierLogo, DemoTag, Empty } from '../components/ui';
import { useApp } from '../context';
import { fmtDate, fmtTime, go, inr } from '../lib';

export function OrderDetail({ orderNo }: { orderNo: string }) {
  const { orders } = useApp();
  const o = orders.find(x => x.orderNo === orderNo);
  if (!o) return <Empty icon="❓" title="Order not found" text="We couldn't find that order." action={<Btn onClick={() => go('/orders')}>My Orders</Btn>} />;
  const c = o.customer;
  return (
    <>
      <a href="#/orders" className="text-sm font-semibold text-brand">← Back to orders</a>
      <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-extrabold sm:text-3xl">{o.orderNo}</h1><StatusBadge o={o} /><DemoTag /></div>
      <p className="mb-6 text-sm text-slate-500">Placed on {fmtDate(o.createdAt)} at {fmtTime(o.createdAt)}</p>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className="mb-3 font-extrabold">Products</h3>
            <ul className="divide-y divide-slate-100 text-sm">
              {o.items.map(i => <li key={i.id} className="flex justify-between py-2.5"><span>{i.emoji} {i.name} <span className="text-slate-400">× {i.qty}</span></span><b>{inr(i.price * i.qty)}</b></li>)}
            </ul>
          </Card>
          <Card>
            <div className="mb-4 flex items-center justify-between"><h3 className="font-extrabold">Tracking history</h3><Btn kind="ghost" className="!py-1.5" onClick={() => go('/track?awb=' + o.awb)}>Open tracker</Btn></div>
            <Timeline order={o} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <h3 className="mb-2 font-extrabold">Delivery address</h3>
            <p className="text-sm">{c.name}<br />{c.address}<br />{c.city}, {c.state} – {c.pin}<br /><span className="text-slate-500">{c.mobile} · {c.email}</span></p>
          </Card>
          <Card>
            <h3 className="mb-3 font-extrabold">Courier & charges</h3>
            <div className="mb-3 flex items-center gap-3"><CourierLogo c={o.courier} /><div className="text-sm"><b>{o.courier.service}</b> · {o.courier.tat}<div className="font-mono text-xs text-slate-500">{o.awb}</div></div></div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Product subtotal</span><b>{inr(o.subtotal)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Shipping</span><b>{inr(o.shipping)}</b></div>
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-extrabold"><span>Total</span><span>{inr(o.total)}</span></div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
