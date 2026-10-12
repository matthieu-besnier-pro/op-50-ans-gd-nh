import React from 'react';
import CadreEcran from '@/components/presentation/CadreEcran';
import { Check } from 'lucide-react';

const CRENEAUX = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00'];
const CHOISI = '10:00';

export default function EcranRdv() {
  return (
    <CadreEcran chemin="/calendrier">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-[13px] font-bold text-gd-navy-dark">Nouveau rendez-vous</p>
          <p className="text-[10px] text-slate-400">GAEC DU BOCAGE · Vire (14)</p>
        </div>
        <div className="flex gap-1">
          <span className="rounded-md bg-gd-navy px-2.5 py-1 text-[10px] font-semibold text-white">RDV Matériel</span>
          <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-500">RDV Atelier</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-2 text-[11px] font-semibold text-slate-600">Mercredi 15 octobre</p>
        <div className="grid grid-cols-4 gap-1.5">
          {CRENEAUX.map((h) => {
            const actif = h === CHOISI;
            return (
              <span
                key={h}
                className={`flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold ${
                  actif ? 'bg-gd-orange text-gd-navy-dark' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {actif && <Check className="h-3 w-3" />}
                {h}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <span className="rounded-md bg-gd-orange px-4 py-1.5 text-[11px] font-bold text-gd-navy-dark">
          Confirmer le rendez-vous
        </span>
      </div>
    </CadreEcran>
  );
}