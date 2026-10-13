import React from 'react';
import CadreEcran from '@/components/presentation/CadreEcran';
import { Star } from 'lucide-react';

const CLIENTS = [
  { nom: 'EARL DU MOULIN', ville: 'Caen (14)', parc: '🚜 3 · 🚛 1', statut: 'À contacter', cible: true },
  { nom: 'SCEA LES PEUPLIERS', ville: 'Bayeux (14)', parc: '🚜 2', statut: 'À rappeler' },
  { nom: 'GAEC DU BOCAGE', ville: 'Vire (14)', parc: '🚜 5 · ⭕ 1', statut: 'RDV Commercial obtenu' },
  { nom: 'CUMA VAL DE SAIRE', ville: 'Saint-Lô (50)', parc: '🚜 4', statut: 'À contacter', agri: 'Trimble' }
];

const STATUT_STYLE = {
  'À contacter': 'bg-slate-200 text-slate-600',
  'À rappeler': 'bg-amber-100 text-amber-700',
  'RDV Commercial obtenu': 'bg-emerald-100 text-emerald-700'
};

const GRILLE = 'grid grid-cols-[1.7fr_0.7fr_1.1fr_0.7fr] items-center gap-2';

export default function EcranClients() {
  return (
    <CadreEcran chemin="/portefeuille">
      <div className="mb-2 flex items-end justify-between">
        <p className="text-[13px] font-bold text-gd-navy-dark">Mes clients</p>
        <p className="text-[11px] font-semibold text-gd-orange">4 clients · 1 cible prioritaire</p>
      </div>

      {/* Les filtres tels qu'ils existent dans l'outil */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-gd-orange px-2 py-1 text-[10px] font-bold text-gd-navy-dark">★ Mes cibles</span>
        <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-500">Parc cible</span>
        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">🛰️ Agri. précision</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className={`${GRILLE} border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400`}>
          <span>Raison sociale</span>
          <span>Parc</span>
          <span>Statut</span>
          <span />
        </div>

        {CLIENTS.map((c) => (
          <div
            key={c.nom}
            className={`${GRILLE} border-b border-slate-100 px-3 py-2 last:border-0 ${c.cible ? 'bg-gd-orange/5' : ''}`}
          >
            <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-slate-700">
              {c.cible && <Star className="h-3 w-3 shrink-0 text-gd-orange" fill="currentColor" />}
              <span className="truncate">{c.nom}</span>
              <span className="shrink-0 text-[10px] font-normal text-slate-400">· {c.ville}</span>
              {c.agri && (
                <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 text-[9px] font-semibold text-emerald-700">
                  🛰️ {c.agri}
                </span>
              )}
            </span>
            <span className="text-[11px] text-slate-500">{c.parc}</span>
            <span className={`justify-self-start rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUT_STYLE[c.statut]}`}>
              {c.statut}
            </span>
            <span className="justify-self-end rounded-md bg-gd-orange px-2 py-1 text-[10px] font-bold text-gd-navy-dark">
              Ajout RDV
            </span>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[10px] text-slate-400">
        Les vôtres seront déjà chargés, vos cibles étoilées en tête. Un filtre isole l'agriculture de précision.
      </p>
    </CadreEcran>
  );
}