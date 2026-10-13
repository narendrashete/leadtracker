import { StatusBadge } from '../components/Timeline';
import { Btn, Card, Empty, Title } from '../components/ui';
import { useApp } from '../context';
import { DAY, fmtDate, go, inr } from '../lib';

export function Orders() {
  const { orders } = useApp();
  if (!orders.length) return <><Title>My Orders</Title><Empty icon="📭" title="No orders yet" text="Orders you place in this demo session appear here." action={<Btn onClick={() => go('/products')}>Start shopping</Btn>} /></>;
  return (
    <>
      <Title sub="Orders created in this demo session">My Orders</Title>
      <Card className="overflow-x-auto !p-0">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{['Order No', 'Date', 'Items', 'Amount', 'Courier', 'AWB', 'Status', 'Est. Delivery', 'Actions'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(o => (
              <tr key={o.orderNo} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold">{o.orderNo}</td>
                <td className="px-4 py-3">{fmtDate(o.createdAt)}</td>
                <td className="px-4 py-3">{o.items.reduce((s, i) => s + i.qty, 0)}</td>
                <td className="px-4 py-3 font-semibold">{inr(o.total)}</td>
                <td className="px-4 py-3">{o.courier.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{o.awb}</td>
                <td className="px-4 py-3"><StatusBadge o={o} /></td>
                <td className="px-4 py-3">{fmtDate(o.createdAt + o.courier.days * DAY)}</td>
                <td className="px-4 py-3"><div className="flex gap-1">
                  <Btn kind="ghost" className="!px-3 !py-1.5" onClick={() => go('/orders/' + o.orderNo)}>View Details</Btn>
                  <Btn className="!px-3 !py-1.5" onClick={() => go('/track?awb=' + o.awb)}>Track</Btn>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
