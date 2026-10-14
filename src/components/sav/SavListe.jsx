import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatutInline from '@/components/StatutInline';
import { metaOffre, labelOffre } from '@/lib/offresSav';
import { useAuth } from '@/lib/AuthContext';
import { ArrowRight } from 'lucide-react';

// Liste de travail SAV : chaque client avec ses offres SAV à proposer et son statut,
// modifiable directement depuis la liste.
export default function SavListe({ clients, onSaved }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground shadow-sm">
        Aucune cible SAV pour ce filtre.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Site</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Offres SAV à proposer</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statut</th>
            <th className="w-24"></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{c.raison_sociale}</p>
                <p className="text-xs text-muted-foreground">{c.tel_mobile || c.adresse_complete || '—'}</p>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{c.site_atelier || c.secteur || '—'}</td>
              <td className="px-4 py-3">
                {(c.offres_sav || []).length === 0 ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {(c.offres_sav || []).map((o) => (
                      <span key={o} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${metaOffre(o).puce}`}>
                        <span role="img" aria-hidden="true">{metaOffre(o).emoji}</span> {labelOffre(o)}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <StatutInline client={c} user={user} onSaved={onSaved} viaServeur />
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => navigate(`/client/${c.id}`)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gd-navy hover:text-gd-orange"
                >
                  Fiche <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}