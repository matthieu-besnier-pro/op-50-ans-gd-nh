import React from 'react';
import { cn } from '@/lib/utils';

const STATUT_STYLES = {
  'À contacter': 'bg-slate-100 text-slate-700 border-slate-200',
  'Injoignable': 'bg-orange-50 text-orange-700 border-orange-200',
  'À rappeler': 'bg-amber-50 text-amber-700 border-amber-200',
  'Contacté sans suite': 'bg-slate-100 text-slate-500 border-slate-200',
  'RDV obtenu': 'bg-blue-50 text-blue-700 border-blue-200',
  'Prise de RDV atelier': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Devis en cours': 'bg-violet-50 text-violet-700 border-violet-200',
  'Offre magasin à proposer': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Vente conclue': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Refus': 'bg-red-50 text-red-700 border-red-200'
};

export default function StatusBadge({ statut, className }) {
  if (!statut) return null;
  const style = STATUT_STYLES[statut] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', style, className)}>
      {statut}
    </span>
  );
}