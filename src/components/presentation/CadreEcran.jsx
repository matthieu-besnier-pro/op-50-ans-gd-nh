import React from 'react';

// Fenêtre d'appli stylisée : met en scène les écrans d'illustration de la présentation.
export default function CadreEcran({ chemin, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl">
      {/* Barre de fenêtre */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 truncate rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
          op-50-ans-gd-nh.base44.app{chemin}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-gd-navy/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gd-navy">
          Données d'exemple
        </span>
      </div>
      {/* Contenu de l'écran */}
      <div className="bg-slate-50 p-4">{children}</div>
    </div>
  );
}