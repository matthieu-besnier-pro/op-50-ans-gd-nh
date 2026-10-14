import React from 'react';
import { useNavigate } from 'react-router-dom';
import MarquesAtelier from '@/components/sav/MarquesAtelier';
import RdvMentions from '@/components/RdvMentions';
import ParcPictos from '@/components/ParcPictos';
import TelephoneClient from '@/components/TelephoneClient';
import { UsagesClient, SourcesAgriPrecision } from '@/components/MaterielPicto';
import { villeClientTexte } from '@/lib/localisationClient';
import { metaOffre, labelOffre } from '@/lib/offresSav';
import { ArrowRight } from 'lucide-react';

// Liste de travail SAV, présentée comme le portefeuille commercial (téléphone, parc,
// prochain RDV, commercial) mais sans les scores d'appétence. Chaque client avec ses
// offres SAV à proposer et le suivi du contact atelier (contacté, puis OK pour un RDV).
export default function SavListe({ clients, onSaved, nomCommerciaux }) {
  const navigate = useNavigate();
  const commerciaux = nomCommerciaux || (() => '—');

  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground shadow-sm">
        Aucune cible SAV pour ce filtre.
      </div>
    );
  }

  const ouvrirFiche = (c) => navigate(`/client/${c.id}`);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Téléphone</th>
            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">Site</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Offres SAV à proposer</th>
            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">Parc cible</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statut</th>
            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">Prochain RDV</th>
            <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">Commercial</th>
            <th className="w-32"></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => {
            const loc = villeClientTexte(c);
            return (
              <tr
                key={c.id}
                onClick={() => ouvrirFiche(c)}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-semibold text-foreground">
                    {/* Le nom ouvre la fiche client complète. */}
                    <button
                      type="button"
                      onClick={() => ouvrirFiche(c)}
                      title="Ouvrir la fiche client"
                      className="text-left transition-colors hover:text-gd-orange hover:underline"
                    >
                      {c.raison_sociale}
                    </button>
                    {loc && <span className="text-xs font-normal text-muted-foreground">· {loc}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.type_structure || 'Exploitation'} · {c.siren || '—'}
                  </p>
                  {Array.isArray(c.usages) && c.usages.length > 0 && <UsagesClient usages={c.usages} className="mt-1" />}
                  <SourcesAgriPrecision sources={c.sources_agri_precision} className="mt-1" />
                  {/* Tablette / petit écran : le parc remonte sous le nom (sa colonne revient en grand écran). */}
                  <div className="mt-1.5 xl:hidden"><ParcPictos pictos={c.parc_pictos} /></div>
                </td>
                {/* Le clic sur un numéro lance l'appel : il ne doit pas ouvrir la fiche. */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><TelephoneClient client={c} /></td>
                <td className="hidden px-4 py-3 text-xs text-muted-foreground xl:table-cell">{c.site_atelier || '—'}</td>
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
                <td className="hidden px-4 py-3 xl:table-cell"><ParcPictos pictos={c.parc_pictos} /></td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <MarquesAtelier client={c} onSaved={onSaved} />
                  {/* Suivis déjà obtenus : un RDV commercial reste mentionné à côté du suivi atelier. */}
                  <RdvMentions client={c} className="mt-1.5" />
                </td>
                <td className="hidden px-4 py-3 text-sm text-muted-foreground xl:table-cell">{c.date_prochain_rdv || '—'}</td>
                <td className="hidden px-4 py-3 text-sm text-foreground xl:table-cell">{commerciaux(c)}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => ouvrirFiche(c)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-gd-navy hover:text-gd-orange whitespace-nowrap"
                    >
                      Fiche <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}