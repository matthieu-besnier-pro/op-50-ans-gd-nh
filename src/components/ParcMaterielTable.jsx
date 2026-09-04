import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const FIELDS = [
  { key: 'num_plaque', label: 'N° de plaque' },
  { key: 'vin', label: 'VIN' },
  { key: 'categorie_1', label: 'Catégorie 1' },
  { key: 'categorie_2', label: 'Catégorie 2' },
  { key: 'categorie_3', label: 'Catégorie 3' },
  { key: 'genre_complet', label: 'Genre complet' },
  { key: 'famille_materiel', label: 'Famille matériel' },
  { key: 'occasion_neuf', label: 'Neuf / Occasion' },
  { key: 'propriete', label: 'Propriété' },
  { key: 'premiere_immat', label: 'Première immat.' },
  { key: 'derniere_immat', label: 'Dernière immat.' },
  { key: 'date_achat', label: "Date d'achat" },
  { key: 'puissance_fiscale', label: 'Puissance fiscale' },
  { key: 'puissance', label: 'Puissance (ch)' },
  { key: 'heures_moteur', label: 'Heures moteur' },
  { key: 'age_estime', label: 'Âge estimé (ans)' },
  { key: 'prix_materiel', label: 'Prix du matériel', format: 'euro' },
  { key: 'temps_moyen_entre_deux_achats', label: 'Délai entre achats (ans)' },
  { key: 'prochain_achat', label: 'Prochain achat' },
  { key: 'date_fin_vie', label: 'Fin de vie estimée' },
];

function formatValue(field, val) {
  if (val == null || val === '') return '—';
  if (field.format === 'euro') return Number(val).toLocaleString('fr-FR') + ' €';
  return val;
}

export default function ParcMaterielTable({ materiels }) {
  const [expanded, setExpanded] = useState(null);

  if (!materiels || materiels.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Aucun matériel enregistré.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="w-8"></th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modèle</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Marque</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prochain achat</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fin de vie</th>
          </tr>
        </thead>
        <tbody>
          {materiels.map((m) => {
            const isOpen = expanded === m.id;
            return (
              <React.Fragment key={m.id}>
                <tr
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setExpanded(isOpen ? null : m.id)}
                >
                  <td className="px-3 py-2.5">
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-sm font-semibold text-foreground">{m.modele || '—'}</p>
                    <p className="text-xs text-muted-foreground">{m.categorie_2 || m.categorie_1 || ''}</p>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-foreground">{m.marque || '—'}</td>
                  <td className="px-3 py-2.5">
                    {m.occasion_neuf && m.occasion_neuf !== 'Inconnu' && (
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        m.occasion_neuf === 'Neuf'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}>{m.occasion_neuf}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-sm font-semibold text-gd-orange">{m.prochain_achat || '—'}</td>
                  <td className="px-3 py-2.5 text-sm text-muted-foreground">{m.date_fin_vie || '—'}</td>
                </tr>
                {isOpen && (
                  <tr className="bg-muted/20">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {FIELDS.map((f) => (
                          <div key={f.key}>
                            <p className="text-xs text-muted-foreground">{f.label}</p>
                            <p className="text-sm font-medium text-foreground">{formatValue(f, m[f.key])}</p>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}