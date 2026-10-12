import React from 'react';
import { cn } from '@/lib/utils';
import { couleurStatut } from '@/lib/statuts';

// Le libellé vient de l'administration des statuts (Administration → Statuts) ;
// la couleur suit le ton choisi pour ce statut, avec le rendu d'origine en repli.
export default function StatusBadge({ statut, className }) {
  if (!statut) return null;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', couleurStatut(statut), className)}>
      {statut}
    </span>
  );
}