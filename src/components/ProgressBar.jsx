import React from 'react';
import { cn } from '@/lib/utils';

export default function ProgressBar({ value, max, className, barClassName }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className={cn('h-full rounded-full bg-gd-navy transition-all duration-700 ease-out', barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}