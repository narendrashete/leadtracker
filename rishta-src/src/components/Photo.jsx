import { useEffect, useState } from 'react';
import * as store from '../lib/store.js';
import { Icon } from './Icon.jsx';

const cache = new Map();

export function useImage(key) {
  const [url, setUrl] = useState(() => cache.get(key) || null);
  useEffect(() => {
    let alive = true;
    if (cache.has(key)) {
      setUrl(cache.get(key));
      return;
    }
    const i = key.indexOf(':');
    store
      .imageUrl(key.slice(0, i), key.slice(i + 1))
      .then((u) => {
        if (!u || !alive) return;
        cache.set(key, u);
        setUrl(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  return url;
}

export default function Photo({ id, alt, kind = 'photo' }) {
  const url = useImage(`${kind}:${id}`);
  if (!url)
    return (
      <div className="photo-ph" aria-hidden="true">
        <Icon name="person" />
      </div>
    );
  return <img src={url} alt={alt} loading="lazy" decoding="async" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />;
}
