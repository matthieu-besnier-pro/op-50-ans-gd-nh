import React from 'react';
import { categorieMeta } from '@/components/MaterielPicto';

// Bandeau compact du parc d'un client : pictogramme + nombre par catégorie.
// `pictos` = ["TRACTEURS:3", "MB:1", …] — calculé à l'import et stocké sur le client.
export default function ParcPictos({ pictos, className = '' }) {
  const list = (Array.isArray(pictos) ? pictos : [])
    .map((p) => {
      const [cat, n] = String(p).split(':');
      return { cat, n: Number(n) || 0 };
    })
    .filter((p) => p.cat && p.n > 0)
    .sort((a, b) => b.n - a.n);

  if (list.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {list.map(({ cat, n }) => {
        const meta = categorieMeta(cat);
        return (
          <span
            key={cat}
            title={`${meta.label} : ${n}`}
            className="inline-flex items-center gap-0.5 rounded-md bg-muted/70 px-1.5 py-0.5 text-[11px] font-semibold text-foreground"
          >
            <span className="leading-none" role="img" aria-label={meta.label}>{meta.emoji}</span>
            {n}
          </span>
        );
      })}
    </div>
  );
}