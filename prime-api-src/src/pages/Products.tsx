import { useState } from 'react';
import { Title } from '../components/ui';
import { PRODUCTS } from '../data';
import { Catalog } from './Home';

export function Products() {
  const [q, setQ] = useState(''); const [cat, setCat] = useState('All'); const [sort, setSort] = useState('none');
  const list = PRODUCTS.filter(p => (cat === 'All' || p.category === cat) && p.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (sort === 'asc' ? a.price - b.price : sort === 'desc' ? b.price - a.price : a.id - b.id));
  return <><Title sub="Browse the full demo catalog">All Products</Title><Catalog q={q} setQ={setQ} cat={cat} setCat={setCat} sort={sort} setSort={setSort} list={list} /></>;
}
