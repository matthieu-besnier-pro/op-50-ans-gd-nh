import React from 'react';
import { OFFRES_SAV, metaOffre } from '@/lib/offresSav';

// Bandeau des offres SAV : chaque carte filtre la liste des clients concernés.
export default function SavOffres({ compteurs, filtre, onFiltre }) {
  const cartes = [
    { cle: 'toutes', label: 'Toutes les cibles SAV', valeur: compteurs.total, icone: '🎯', carte: 'border-gd-navy/30 bg-gd-navy/5 text-gd-navy' },
    ...OFFRES_SAV.map((o) => ({ cle: o, label: o, valeur: compteurs.par[o] || 0, icone: metaOffre(o).emoji, carte: metaOffre(o).carte })),
    { cle: 'statut', label: 'Offre SAV à proposer (commerciaux)', valeur: compteurs.aProposer, icone: '🔧', carte: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800' }
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cartes.map((c) => (
        <button
          key={c.cle}
          type="button"
          onClick={() => onFiltre(c.cle)}
          className={`rounded-xl border-2 p-4 text-left transition ${c.carte} ${filtre === c.cle ? 'ring-2 ring-gd-orange ring-offset-1' : 'hover:opacity-90'}`}
        >
          <p className="flex items-start gap-1.5 text-[11px] font-bold uppercase leading-tight tracking-wider">
            <span role="img" aria-hidden="true">{c.icone}</span> {c.label}
          </p>
          <p className="mt-1 text-2xl font-extrabold">{c.valeur}</p>
        </button>
      ))}
    </div>
  );
}