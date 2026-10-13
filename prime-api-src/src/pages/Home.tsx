import { useState, useMemo } from 'react';
import { ProductCard } from '../components/ProductCard';
import { Btn, Empty } from '../components/ui';
import { CATEGORIES, PRODUCTS } from '../data';
import type { Product } from '../types';

export function Home() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [sort, setSort] = useState('none');
  const list = useMemo(() => {
    let l = PRODUCTS.filter(p => (cat === 'All' || p.category === cat) && p.name.toLowerCase().includes(q.trim().toLowerCase()));
    if (sort === 'asc') l = [...l].sort((a, b) => a.price - b.price);
    if (sort === 'desc') l = [...l].sort((a, b) => b.price - a.price);
    return l;
  }, [q, cat, sort]);
  return (
    <>
      <section className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-navy via-brand to-accent p-8 text-white sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-200">Demo store · Multi-courier shipping</p>
        <h1 className="mt-2 max-w-xl text-3xl font-black sm:text-5xl">Shop smart. Ship with the courier you choose.</h1>
        <p className="mt-3 max-w-lg text-indigo-100">Compare GATI, Xpressbees and Shiprocket at checkout — price, speed and delivery date side by side.</p>
        <a href="#/products" className="mt-6 inline-block rounded-xl bg-white px-5 py-3 text-sm font-bold text-brand shadow hover:bg-indigo-50">Start shopping →</a>
      </section>
      <Catalog q={q} setQ={setQ} cat={cat} setCat={setCat} sort={sort} setSort={setSort} list={list} />
    </>
  );
}

export function Catalog({ q, setQ, cat, setCat, sort, setSort, list }: any) {
  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="absolute left-3 top-2.5">🔍</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products…" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-indigo-100" />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold">
          <option value="none">Sort: Featured</option><option value="asc">Price: Low to High</option><option value="desc">Price: High to Low</option>
        </select>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)} className={'rounded-full px-4 py-1.5 text-sm font-semibold transition ' + (cat === c ? 'bg-brand text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{c}</button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty icon="🔎" title="No products found" text="Try a different search or category." action={<Btn kind="ghost" onClick={() => { setQ(''); setCat('All'); }}>Clear filters</Btn>} />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{list.map((p: Product) => <ProductCard key={p.id} p={p} />)}</div>
      )}
    </section>
  );
}
