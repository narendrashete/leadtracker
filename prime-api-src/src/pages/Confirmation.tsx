import { Btn, Card, DemoTag, Empty } from '../components/ui';
import { useApp } from '../context';
import { DAY, fmtDate, go, inr, statusOf } from '../lib';

export function Confirmation({ orderNo }: { orderNo: string }) {
  const { orders } = useApp();
  const o = orders.find(x => x.orderNo === orderNo);
  if (!o) return <Empty icon="❓" title="Order not found" text="We couldn't find that order." action={<Btn onClick={() => go('/orders')}>My Orders</Btn>} />;
  const rows: [string, any][] = [
    ['Order Number', o.orderNo], ['Courier Partner', o.courier.name], ['AWB Number', <span className="font-mono">{o.awb}</span>],
    ['Shipment Status', statusOf(o)], ['Estimated Delivery', fmtDate(o.createdAt + o.courier.days * DAY)], ['Amount paid (demo)', inr(o.total)],
  ];
  return (
    <div className="mx-auto max-w-2xl text-center pop">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-4xl">✅</div>
      <h1 className="mt-4 text-3xl font-black">Order Confirmed!</h1>
      <p className="mt-1 text-slate-500">Thanks {o.customer.name.split(' ')[0]}, your shipment has been booked.</p>
      <Card className="mt-6 text-left">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-extrabold">Shipment details</h3><DemoTag /></div>
        <dl className="divide-y divide-slate-100 text-sm">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between py-2.5"><dt className="text-slate-500">{k}</dt><dd className="font-bold">{v}</dd></div>)}
        </dl>
        <p className="mt-3 text-xs text-slate-400">This AWB is simulated and is not a genuine courier tracking number.</p>
      </Card>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Btn onClick={() => go('/track?awb=' + o.awb)}>📍 Track Shipment</Btn>
        <Btn kind="ghost" onClick={() => go('/orders/' + o.orderNo)}>View Order Details</Btn>
        <Btn kind="ghost" onClick={() => go('/products')}>Continue Shopping</Btn>
      </div>
    </div>
  );
}
