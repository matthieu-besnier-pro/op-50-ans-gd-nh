import React from 'react';
import { cn } from '@/lib/utils';

export default function StatCard({ label, value, sublabel, icon: Icon, accent, className, children }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm', className)}>
      {accent && (
        <div className="absolute right-0 top-0 h-20 w-20 -translate-y-6 translate-x-6 rounded-full bg-gd-orange/10 blur-2xl" />
      )}
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-extrabold text-foreground tabular-nums">{value}</p>
          {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
        </div>
        {Icon && (
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', accent ? 'bg-gd-orange/15 text-gd-navy' : 'bg-muted text-muted-foreground')}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}