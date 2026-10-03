import React from 'react';
import { cn } from '@/lib/utils';

// Jauge d'appétence : barre graduée 0 → 100 avec dégradé orange → vert
// (orange = à explorer, vert = à saisir) pour rester motivant.
const NIVEAUX = {
  Fort: { label: 'À saisir', gradient: 'bg-gradient-to-r from-amber-400 via-lime-400 to-emerald-500', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Moyen: { label: 'À cultiver', gradient: 'bg-gradient-to-r from-orange-300 via-amber-400 to-lime-400', text: 'text-gd-orange', dot: 'bg-gd-orange' },
  Faible: { label: 'À explorer', gradient: 'bg-gradient-to-r from-sky-300 to-orange-300', text: 'text-sky-700', dot: 'bg-sky-400' }
};

const EMPTY = { label: 'À explorer', gradient: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground/40' };

export function appetenceMeta(niveau, score) {
  if (!niveau && score == null) return EMPTY;
  if (niveau) return NIVEAUX[niveau] || EMPTY;
  if (score >= 66) return NIVEAUX.Fort;
  if (score >= 36) return NIVEAUX.Moyen;
  return NIVEAUX.Faible;
}

export default function AppetenceGauge({ score, niveau, className, width = 'w-28' }) {
  const meta = appetenceMeta(niveau, score);
  const pct = Math.max(0, Math.min(100, Number(score) || 0));

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn('text-xs font-semibold', meta.text)}>{meta.label}</span>
        <span className="text-xs font-bold tabular-nums text-foreground">{pct}<span className="text-[10px] font-medium text-muted-foreground">/100</span></span>
      </div>
      <div className={cn('mt-1 h-2 overflow-hidden rounded-full bg-muted', width)}>
        <div className={cn('h-full rounded-full transition-all', meta.gradient)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}