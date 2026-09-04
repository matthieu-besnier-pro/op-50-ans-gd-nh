import React from 'react';
import { cn } from '@/lib/utils';
import { Flame, Sparkles, Compass } from 'lucide-react';

const NIVEAU_CONFIG = {
  'Fort': { icon: Flame, label: 'À saisir', classes: 'bg-emerald-500 text-white', dot: 'bg-emerald-300' },
  'Moyen': { icon: Sparkles, label: 'À cultiver', classes: 'bg-gd-orange/15 text-gd-orange', dot: 'bg-gd-orange' },
  'Faible': { icon: Compass, label: 'À explorer', classes: 'bg-sky-100 text-sky-600', dot: 'bg-sky-400' }
};

export default function AppetenceBadge({ niveau, score, className }) {
  if (!niveau) return null;
  const config = NIVEAU_CONFIG[niveau] || NIVEAU_CONFIG['Faible'];
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', config.classes, className)}>
      <Icon className="h-3 w-3" />
      {config.label}
      {score != null && <span className="opacity-70">· {score}</span>}
    </span>
  );
}