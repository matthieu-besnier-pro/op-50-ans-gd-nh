import React, { useMemo } from 'react';
import Layout from '@/components/Layout';
import Loader from '@/components/Loader';
import { listerPartage } from '@/lib/donneesPartagees';
import { useOperationStats } from '@/lib/useOperationStats';
import { TrendingUp, CheckCircle2, Clock } from 'lucide-react';

/**
 * Suivi des ventes — le tableau de marche de l'opération.
 *
 * Reprend la maille du suivi papier des opérations précédentes : une ligne par
 * vendeur, une colonne par type de machine, et les totaux. Les ventes viennent
 * des déclarations du groupe WhatsApp, validées ou non : on suit ce qui est
 * annoncé sur le terrain, la validation vient après.
 */

// L'ordre des colonnes est celui du tableau de suivi historique.
const MACHINES = [
  { cle: 'Tracteur', court: 'TR', libelle: 'Tracteur' },
  { cle: 'Télescopique', court: 'TÉL', libelle: 'Télescopique' },
  { cle: 'Ensileuse', court: 'EN', libelle: 'Ensileuse' },
  { cle: 'Moissonneuse', court: 'MB', libelle: 'Moissonneuse' },
  { cle: 'Round Baler', court: 'RD', libelle: 'Round' },
  { cle: 'Big Baler', court: 'BG', libelle: 'Big' },
  { cle: 'Machine à vendanger', court: 'MAV', libelle: 'Mach. à vendanger' },
  { cle: 'Agri. précision', court: 'AGP', libelle: 'Agri. précision (GPS, guidage)' }
];

function Carte({ Icone, valeur, libelle, accent }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">{libelle}</p>
        <Icone className={`h-4 w-4 ${accent}`} />
      </div>
      <p className="text-3xl font-extrabold text-gd-navy-dark">{valeur}</p>
    </div>
  );
}

export default function SuiviVentes() {
  const stats = useOperationStats();
  const [structure, setStructure] = React.useState([]);
  const [users, setUsers] = React.useState([]);

  React.useEffect(() => {
    listerPartage('structure_commerciale', '-nom_commercial', 500).then(setStructure).catch(() => {});
    listerPartage('User', '-created_date', 500).then(setUsers).catch(() => {});
  }, []);

  // Nom affichable d'un vendeur : son compte, sinon sa fiche de secteur.
  const nomPar = useMemo(() => {
    const m = {};
    (structure || []).forEach((f) => { if (f.user_id) m[f.user_id] = f.nom_commercial; });
    (users || []).forEach((u) => { if (u.full_name) m[u.id] = u.full_name; });
    return m;
  }, [structure, users]);

  const suivi = stats?.ventes?.suivi || null;

  const lignes = useMemo(() => {
    const par = suivi?.par_commercial || {};
    return Object.entries(par)
      .map(([id, v]) => ({
        id,
        nom: nomPar[id] || `Vendeur ${String(id).slice(-4)}`,
        machines: v.machines || {},
        total: v.total || 0,
        validees: v.validees || 0
      }))
      .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom));
  }, [suivi, nomPar]);

  const totauxMachines = suivi?.par_machine || {};
  // Un type de machine absent de la liste historique — un outil, un kit — ne
  // doit pas disparaître du total : on le regroupe sous « Autre ».
  const connus = new Set(MACHINES.map((m) => m.cle));
  const autres = Object.entries(totauxMachines)
    .filter(([k]) => !connus.has(k))
    .reduce((s, [, n]) => s + n, 0);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gd-navy-dark">Suivi des ventes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Déclarations du groupe WhatsApp, par vendeur et par type de machine.
        </p>
      </div>

      {!stats ? (
        <Loader />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Carte Icone={TrendingUp} valeur={suivi?.total ?? 0} libelle="Ventes déclarées" accent="text-gd-orange" />
            <Carte Icone={CheckCircle2} valeur={suivi?.validees ?? 0} libelle="Validées" accent="text-emerald-600" />
            <Carte
              Icone={Clock}
              valeur={Math.max((suivi?.total ?? 0) - (suivi?.validees ?? 0), 0)}
              libelle="En attente de validation"
              accent="text-muted-foreground"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Vendeur
                  </th>
                  {MACHINES.map((m) => (
                    <th
                      key={m.cle}
                      title={m.libelle}
                      className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {m.court}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 ? (
                  <tr>
                    <td colSpan={MACHINES.length + 2} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Aucune vente déclarée pour l'instant.
                    </td>
                  </tr>
                ) : (
                  lignes.map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm">
                        <span className="font-semibold text-foreground">{l.nom}</span>
                        {l.validees < l.total && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {l.validees} validée{l.validees > 1 ? 's' : ''} sur {l.total}
                          </span>
                        )}
                      </td>
                      {MACHINES.map((m) => {
                        const n = l.machines[m.cle] || 0;
                        return (
                          <td
                            key={m.cle}
                            className={`px-3 py-3 text-center text-sm tabular-nums ${
                              n > 0 ? 'font-bold text-gd-navy' : 'text-muted-foreground/40'
                            }`}
                          >
                            {n || '—'}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right text-lg font-extrabold tabular-nums text-gd-navy">
                        {l.total}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {lignes.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/50">
                    <td className="px-4 py-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Total
                    </td>
                    {MACHINES.map((m) => (
                      <td key={m.cle} className="px-3 py-3 text-center text-sm font-extrabold tabular-nums text-gd-navy-dark">
                        {totauxMachines[m.cle] || 0}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-lg font-extrabold tabular-nums text-gd-navy-dark">
                      {suivi?.total ?? 0}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {autres > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {autres} vente{autres > 1 ? 's' : ''} portent sur un matériel hors de ces sept familles
              (outil, kit, équipement). Elles comptent dans le total mais n'ont pas de colonne.
            </p>
          )}
        </>
      )}
    </Layout>
  );
}
