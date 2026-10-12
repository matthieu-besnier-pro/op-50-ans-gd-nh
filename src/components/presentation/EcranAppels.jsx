import React from 'react';
import CadreEcran from '@/components/presentation/CadreEcran';
import { Phone, Check, ChevronRight } from 'lucide-react';

const STATUTS = ['À contacter', 'Injoignable', 'À rappeler', 'Contacté sans suite'];

export default function EcranAppels() {
  return (
    <CadreEcran chemin="/portefeuille">
      <div className="grid grid-cols-[1fr_0.85fr] gap-3">
        {/* La ligne du client */}
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[12px] font-bold text-slate-700">EARL DU MOULIN</p>
          <p className="mb-3 text-[10px] text-slate-400">Caen (14) · 🚜 3 · 🚛 1</p>

          <span className="inline-flex items-center gap-1.5 rounded-md bg-gd-navy px-3 py-1.5 text-[11px] font-semibold text-white">
            <Phone className="h-3.5 w-3.5" /> Appeler 06 12 34 56 78
          </span>

          <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
            Pas de réponse : on qualifie, on enchaîne.
          </p>
        </div>

        {/* Le statut, changé d'un clic */}
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Statut</p>
          <div className="space-y-1">
            {STATUTS.map((s) => {
              const actif = s === 'Injoignable';
              return (
                <div
                  key={s}
                  className={`flex items-center justify-between rounded-md px-2 py-1.5 text-[11px] ${
                    actif ? 'bg-gd-navy font-semibold text-white' : 'text-slate-600'
                  }`}
                >
                  {s}
                  {actif && <Check className="h-3.5 w-3.5" />}
                </div>
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2 text-[10px] font-semibold text-gd-orange">
            <ChevronRight className="h-3 w-3" /> Client suivant
          </p>
        </div>
      </div>
    </CadreEcran>
  );
}