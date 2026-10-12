import React from 'react';
import CadreEcran from '@/components/presentation/CadreEcran';
import { Check, Trophy } from 'lucide-react';

const LIGNES = [
  ['Client', 'GAEC DU BOCAGE'],
  ['Commercial', 'Julien M.'],
  ['Machine', 'Tracteur T7.300'],
  ['Reprise', 'Reprise NH'],
  ['Statut', 'Validé']
];

export default function EcranVente() {
  return (
    <CadreEcran chemin="/grand-ecran">
      {/* Le message envoyé comme d'habitude */}
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-emerald-100 px-3 py-2">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
            Groupe WhatsApp · Opé 50 ans
          </p>
          <p className="text-[11px] leading-snug text-emerald-900">
            Vente T7.300 Auto Command — GAEC DU BOCAGE — reprise NH T6.175
          </p>
          <p className="mt-1 text-right text-[9px] text-emerald-700/70">Julien M. · 10:12</p>
        </div>
      </div>

      {/* Ce que l'outil en a fait */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-gd-navy-dark">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-3 w-3 text-emerald-600" />
          </span>
          Vente reconnue et rattachée
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {LIGNES.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-1 last:border-0">
              <span className="text-[10px] text-slate-400">{k}</span>
              <span className="text-[11px] font-semibold text-slate-700">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* La reconnaissance */}
      <div className="mt-3 flex items-center gap-2 rounded-full border border-gd-orange/40 bg-gd-orange/10 px-3 py-1.5">
        <Trophy className="h-3.5 w-3.5 shrink-0 text-gd-orange" />
        <span className="text-[11px] font-semibold text-gd-navy-dark">
          Badge « Chasseur de reprises » décroché — affiché sur le Grand Écran
        </span>
      </div>
    </CadreEcran>
  );
}