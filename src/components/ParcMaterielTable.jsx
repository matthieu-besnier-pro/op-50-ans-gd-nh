import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Tractor } from 'lucide-react';

const ALL_FIELDS = [
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
  if (val == null || val === '') return null;
  if (field.format === 'euro') return Number(val).toLocaleString('fr-FR') + ' €';
  return String(val);
}

export default function ParcMaterielTable({ materiels }) {
  const [expanded, setExpanded] = useState(null);

  const summary = useMemo(() => {
    if (!materiels || materiels.length === 0) return null;
    const brands = {};
    const types = { Neuf: 0, Occasion: 0, Inconnu: 0 };
    let withImmat = 0;
    let oldestAge = null;
    materiels.forEach((m) => {
      if (m.marque) brands[m.marque] = (brands[m.marque] || 0) + 1;
      if (m.occasion_neuf) types[m.occasion_neuf] = (types[m.occasion_neuf] || 0) + 1;
      if (m.premiere_immat) {
        withImmat++;
        const age = (new Date() - new Date(m.premiere_immat)) / (365.25 * 86400000);
        if (oldestAge === null || age > oldestAge) oldestAge = age;
      }
    });
    const topBrands = Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n} (${c})`);
    return { total: materiels.length, topBrands, types, withImmat, oldestAge: oldestAge !== null ? Math.round(oldestAge) : null };
  }, [materiels]);

  if (!materiels || materiels.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Aucun matériel enregistré pour ce client.</p>;
  }

  return (
    <div>
      {/* Summary header */}
      {summary && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 px-4 py-2.5 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-gd-navy">
            <Tractor className="h-4 w-4 text-gd-orange" /> {summary.total} machine{summary.total > 1 ? 's' : ''}
          </span>
          {summary.topBrands.length > 0 && (
            <span className="text-muted-foreground">· {summary.topBrands.join(', ')}</span>
          )}
          {summary.types.Neuf > 0 && <span className="text-emerald-600 font-medium">{summary.types.Neuf} neuf{summary.types.Neuf > 1 ? 's' : ''}</span>}
          {summary.types.Occasion > 0 && <span className="text-amber-600 font-medium">{summary.types.Occasion} occasion{summary.types.Occasion > 1 ? 's' : ''}</span>}
          {summary.oldestAge !== null && <span className="text-muted-foreground">· plus ancienne : {summary.oldestAge} ans</span>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="w-8"></th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modèle</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Marque</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">1ère immat.</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Âge</th>
            </tr>
          </thead>
          <tbody>
            {materiels.map((m) => {
              const isOpen = expanded === m.id;
              const age = m.premiere_immat ? Math.round((new Date() - new Date(m.premiere_immat)) / (365.25 * 86400000)) : null;
              // Only show non-empty fields in detail
              const detailFields = ALL_FIELDS.filter(f => formatValue(f, m[f.key]) !== null);
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
                      <p className="text-xs text-muted-foreground">{m.categorie_2 || m.categorie_1 || m.famille_materiel || ''}</p>
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
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">{m.premiere_immat || '—'}</td>
                    <td className="px-3 py-2.5 text-sm">
                      {age !== null ? (
                        <span className={`font-semibold ${age >= 10 ? 'text-red-600' : age >= 7 ? 'text-amber-600' : 'text-emerald-600'}`}>{age} ans</span>
                      ) : '—'}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-muted/20">
                      <td colSpan={6} className="px-6 py-4">
                        {detailFields.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Aucune donnée détaillée disponible pour cette machine.</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {detailFields.map((f) => (
                              <div key={f.key}>
                                <p className="text-xs text-muted-foreground">{f.label}</p>
                                <p className="text-sm font-medium text-foreground">{formatValue(f, m[f.key])}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}