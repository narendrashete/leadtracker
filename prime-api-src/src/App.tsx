import { useState } from 'react';
import { Footer, Nav, Toasts } from './components/Layout';
import { Btn, Empty } from './components/ui';
import { AppCtx } from './context';
import { go, uid, useLocalStorage, useRoute } from './lib';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { Confirmation } from './pages/Confirmation';
import { Home } from './pages/Home';
import { OrderDetail } from './pages/OrderDetail';
import { Orders } from './pages/Orders';
import { Products } from './pages/Products';
import { Shipping } from './pages/Shipping';
import { Track } from './pages/Track';
import type { CartLine, Draft, Order } from './types';

export default function App() {
  const [cart, setCart] = useLocalStorage<CartLine[]>('ss_cart', []);
  const [orders, setOrders] = useLocalStorage<Order[]>('ss_orders', []);
  const [draft, setDraft] = useLocalStorage<Draft | null>('ss_draft', null);
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: string }[]>([]);
  const { path, query } = useRoute();
  const toast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    const id = uid();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800);
  };
  const reset = () => {
    if (!confirm('Clear cart, orders and tracking data?')) return;
    setCart(() => []); setOrders(() => []); setDraft(null); go('/'); toast('Demo data reset');
  };
  const count = cart.reduce((s, c) => s + c.qty, 0);

  let page: any;
  if (path === '/') page = <Home />;
  else if (path === '/products') page = <Products />;
  else if (path === '/cart') page = <Cart />;
  else if (path === '/checkout') page = <Checkout />;
  else if (path === '/shipping') page = <Shipping />;
  else if (path.startsWith('/confirmation/')) page = <Confirmation orderNo={path.split('/')[2]} />;
  else if (path === '/orders') page = <Orders />;
  else if (path.startsWith('/orders/')) page = <OrderDetail orderNo={path.split('/')[2]} />;
  else if (path === '/track') page = <Track initial={query.get('awb') || ''} />;
  else page = <Empty icon="🧭" title="Page not found" text="That page doesn't exist." action={<Btn onClick={() => go('/')}>Go home</Btn>} />;

  return (
    <AppCtx.Provider value={{ cart, setCart, orders, setOrders, draft, setDraft, toast }}>
      <div className="flex min-h-screen flex-col">
        <div className="bg-navy px-4 py-1.5 text-center text-xs font-semibold text-indigo-100">Prototype · simulated couriers, AWBs, tracking &amp; payments — no real shipments are created</div>
        <Nav path={path} count={count} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8" key={path}>{page}</main>
        <Footer onReset={reset} />
        <Toasts items={toasts} />
      </div>
    </AppCtx.Provider>
  );
}
