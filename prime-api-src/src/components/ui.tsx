export function Btn({ children, onClick, kind = 'primary', disabled, className = '', type }: any) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ';
  const kinds: any = {
    primary: 'bg-gradient-to-r from-brand to-accent text-white shadow-md hover:shadow-lg hover:brightness-110',
    ghost: 'border border-slate-200 bg-white text-navy hover:bg-slate-50',
    danger: 'text-rose-600 hover:bg-rose-50',
  };
  return <button type={type || 'button'} disabled={disabled} onClick={onClick} className={base + kinds[kind] + ' ' + className}>{children}</button>;
}

export const Spinner = () => <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;

export const Card = ({ children, className = '' }: any) => <div className={'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ' + className}>{children}</div>;

export const Badge = ({ children, color = 'indigo' }: any) => {
  const c: any = { indigo: 'bg-indigo-50 text-indigo-700', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700', violet: 'bg-violet-50 text-violet-700', slate: 'bg-slate-100 text-slate-600' };
  return <span className={'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ' + c[color]}>{children}</span>;
};

export const DemoTag = ({ text = 'Demo Shipment' }: { text?: string }) => (
  <span className="inline-block rounded-md border border-dashed border-amber-400 bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">{text}</span>
);

export const Stars = ({ r }: { r: number }) => <span className="text-xs text-amber-500">{'★'.repeat(Math.round(r))}<span className="text-slate-300">{'★'.repeat(5 - Math.round(r))}</span> <span className="text-slate-500">{r.toFixed(1)}</span></span>;

export const CourierLogo = ({ c }: { c: { name: string; color: string } }) => (
  <span className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-xl px-3 text-sm font-black tracking-tight text-white" style={{ background: c.color }}>{c.name}</span>
);

export const Title = ({ children, sub }: any) => (
  <div className="mb-6"><h1 className="text-2xl font-extrabold sm:text-3xl">{children}</h1>{sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}</div>
);

export const Empty = ({ icon, title, text, action }: any) => (
  <Card className="py-14 text-center"><div className="text-5xl">{icon}</div><h2 className="mt-3 text-lg font-bold">{title}</h2><p className="mt-1 text-sm text-slate-500">{text}</p><div className="mt-5 flex justify-center">{action}</div></Card>
);
