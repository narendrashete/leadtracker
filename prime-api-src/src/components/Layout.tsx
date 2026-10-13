import { useState } from 'react';
import primeLogo from '../prime-logo.png';

export function Nav({ path, count }: { path: string; count: number }) {
  const [open, setOpen] = useState(false);
  const links = [['/', 'Home'], ['/products', 'Products'], ['/cart', 'My Cart'], ['/orders', 'My Orders'], ['/track', 'Track Shipment']];
  const active = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <a href="#/" className="flex items-center gap-2 text-xl font-black">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-accent text-white">S</span>ShopSphere
        </a>
        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {links.map(([p, l]) => (
            <a key={p} href={'#' + p} className={'rounded-lg px-3 py-2 text-sm font-semibold transition ' + (active(p) ? 'bg-indigo-50 text-brand' : 'text-slate-600 hover:text-navy')}>{l}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a href="#/cart" className="relative rounded-xl border border-slate-200 px-3 py-2 text-lg hover:bg-slate-50" aria-label="Cart">
            🛒{count > 0 && <span className="absolute -right-2 -top-2 grid h-5 min-w-[20px] place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">{count}</span>}
          </a>
          <button className="rounded-xl border border-slate-200 px-3 py-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-100 px-4 py-2 md:hidden">
          {links.map(([p, l]) => <a key={p} href={'#' + p} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold">{l}</a>)}
        </div>
      )}
    </header>
  );
}

export function Footer({ onReset }: { onReset: () => void }) {
  return (
    <footer className="mt-16 border-t border-slate-100 bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div><b className="text-navy">ShopSphere</b> — frontend prototype. Courier rates, AWB numbers and tracking events are simulated and are not real shipping services.</div>
        <button onClick={onReset} className="self-start rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-navy hover:bg-slate-100">Reset demo data</button>
      </div>
      <div className="flex items-center justify-center gap-2 pb-6">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Developed by</span>
        <a href="https://www.primecomputers.co.in" target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 shadow-sm transition hover:-translate-y-px">
          <img src={primeLogo} alt="Prime Computers" className="block h-4 w-auto" />
        </a>
      </div>
    </footer>
  );
}

export function Toasts({ items }: { items: { id: string; msg: string; type: string }[] }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map(t => (
        <div key={t.id} className={'pop rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ' + (t.type === 'err' ? 'bg-rose-600' : 'bg-emerald-600')}>{t.type === 'err' ? '⚠️ ' : '✓ '}{t.msg}</div>
      ))}
    </div>
  );
}
