import { useEffect, useState } from 'react';
import * as db from '../lib/db.js';
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
    db.get('images', key)
      .then((blob) => {
        if (!blob || !alive) return;
        const u = URL.createObjectURL(blob);
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
  return <img src={url} alt={alt} loading="lazy" decoding="async" />;
}
