import React from 'react';
import { cn } from '@/lib/utils';
import { Flame, TrendingUp, TrendingDown } from 'lucide-react';

const NIVEAU_CONFIG = {
  'Fort': { icon: Flame, classes: 'bg-gd-navy text-white', dot: 'bg-gd-orange' },
  'Moyen': { icon: TrendingUp, classes: 'bg-gd-orange/15 text-gd-navy', dot: 'bg-gd-orange' },
  'Faible': { icon: TrendingDown, classes: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' }
};

export default function AppetenceBadge({ niveau, score, className }) {
  if (!niveau) return null;
  const config = NIVEAU_CONFIG[niveau] || NIVEAU_CONFIG['Faible'];
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', config.classes, className)}>
      <Icon className="h-3 w-3" />
      {niveau}
      {score != null && <span className="opacity-70">· {score}</span>}
    </span>
  );
}