import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import MachineIcone from '@/components/MachineIcone';
import OpLogo from '@/components/OpLogo';
import MACHINES from '@/lib/famillesMachines';
import AnneauRepartition from '@/components/AnneauRepartition';
import BandeauEcheance from '@/components/BandeauEcheance';

/**
 * Suivi des ventes — vue PUBLIQUE.
 *
 * Consultable sans compte, sans menu : la page se suffit à elle-même. Fond
 * clair comme la version interne — c'est ce qui se lit le mieux, sur un écran
 * d'accueil comme sur un téléphone.
 *
 * Elle montre le même tableau de marche que la version interne, déclarations
 * comprises. Ce qu'elle ne propose pas, c'est de les modifier.
 */

function Repartition({ titre, donnees, ordre }) {
  const entrees = (ordre || Object.keys(donnees || {}))
    .map((cle) => [cle, (donnees || {})[cle] || 0])
    .filter(([, n]) => n > 0);
  const total = entrees.reduce((s, [, n]) => s + n, 0);
  if (entrees.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-5">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">{titre}</h2>
      <div className="space-y-2">
        {entrees.map(([cle, n]) => (
          <div key={cle}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-foreground">{cle}</span>
              <span className="font-bold tabular-nums text-gd-navy-dark">{n}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gd-orange" style={{ width: `${total > 0 ? (n / total) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SuiviVentesPublic() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState('');
  // Dix déclarations suffisent à voir ce qui se passe ; le reste se déplie.
  const [toutVoir, setToutVoir] = useState(false);

  useEffect(() => {
    let actif = true;
    const charger = () => base44.functions
      .invoke('suivi_ventes_public', {})
      .then((res) => {
        if (!actif) return;
        const d = res?.data || res;
        if (d?.error) throw new Error(d.error);
        setData(d);
        setErreur('');
      })
      .catch(() => { if (actif) setErreur('Les chiffres ne sont pas disponibles pour le moment.'); });
    charger();
    // Le tableau vit : on le rafraîchit sans que personne n'ait à recharger.
    const t = setInterval(charger, 60000);
    return () => { actif = false; clearInterval(t); };
  }, []);

  const suivi = data?.suivi || null;
  const totauxMachines = suivi?.par_machine || {};

  const lignes = useMemo(() => Object.values(suivi?.par_commercial || {})
    .map((v) => ({ ...v, machines: v.machines || {} }))
    .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom)), [suivi]);

  const declarations = suivi?.declarations || [];
  const visibles = toutVoir ? declarations : declarations.slice(0, 10);

  const ventesAgri = totauxMachines['Agri. précision'] || 0;
  const ventesMateriel = Math.max((suivi?.total || 0) - ventesAgri, 0);

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <header className="flex items-center gap-4 border-b border-border px-6 py-5">
        <OpLogo className="h-12 w-12 rounded-full object-contain" fallback={null} />
        <div>
          <h1 className="text-xl font-extrabold leading-none">Suivi des ventes</h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-widest text-gd-orange">
            {data?.operation || '50 ans Gonnin Duris × New Holland'}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {erreur ? (
          <p className="rounded-2xl border border-border bg-card shadow-sm p-8 text-center text-muted-foreground">{erreur}</p>
        ) : !suivi ? (
          <p className="p-8 text-center text-muted-foreground">Chargement…</p>
        ) : (
          <>
            <BandeauEcheance dateFin={data?.date_fin} derniere={suivi?.derniere_declaration} />
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-gd-orange/40 bg-gd-orange/5 p-5">
                <p className="text-4xl font-extrabold tabular-nums text-gd-orange">{suivi.total}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ventes déclarées</p>
              </div>
              <div className="rounded-2xl border border-border bg-card shadow-sm p-5">
                <p className="text-4xl font-extrabold tabular-nums text-gd-navy-dark">{suivi.validees}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Validées</p>
              </div>
              {[
                { famille: 'Tracteur', titre: 'Matériel', ventes: ventesMateriel, rdv: suivi.rdv?.materiel || 0 },
                { famille: 'Agri. précision', titre: 'Agri. précision', ventes: ventesAgri, rdv: suivi.rdv?.agri || 0 }
              ].map((u) => {
                const taux = u.rdv > 0 ? Math.round((u.ventes / u.rdv) * 100) : 0;
                return (
                  <div key={u.titre} className="rounded-2xl border border-border bg-card shadow-sm p-5">
                    <p className="text-4xl font-extrabold tabular-nums text-gd-navy-dark">{taux}%</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Transfo. {u.titre}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{u.ventes} vente(s) / {u.rdv} RDV</p>
                  </div>
                );
              })}
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
              {MACHINES.map((m) => {
                const n = totauxMachines[m.cle] || 0;
                return (
                  <div
                    key={m.cle}
                    className={`rounded-2xl border p-3 text-center ${
                      n > 0 ? 'border-gd-orange/40 bg-gd-orange/5' : 'border-border bg-card shadow-sm'
                    }`}
                  >
                    <MachineIcone
                      famille={m.cle}
                      titre={m.libelle}
                      className={`mx-auto h-14 w-full text-gd-navy-dark ${n > 0 ? '' : 'opacity-40 grayscale'}`}
                    />
                    <p className={`mt-1.5 text-2xl font-extrabold tabular-nums ${n > 0 ? 'text-gd-orange' : 'text-muted-foreground/40'}`}>
                      {n}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
                      {m.libelle}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Vendeur
                    </th>
                    {MACHINES.map((m) => (
                      <th key={m.cle} className="px-3 py-2 text-center align-bottom">
                        <MachineIcone famille={m.cle} titre={m.libelle} className="mx-auto h-9 w-16 text-gd-navy" />
                        <span className="mx-auto mt-1 block max-w-[5.5rem] text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
                          {m.libelle}
                        </span>
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
                      <tr key={l.nom} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-sm font-semibold">{l.nom}</td>
                        {MACHINES.map((m) => {
                          const n = l.machines[m.cle] || 0;
                          return (
                            <td key={m.cle} className="px-3 py-3 text-center">
                              {n > 0 ? (
                                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-gd-navy px-2 text-sm font-bold tabular-nums text-white">
                                  {n}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground/30">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right text-lg font-extrabold tabular-nums text-gd-navy-dark">{l.total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Repartition
                titre="Répartition des ventes"
                donnees={suivi.par_type_vente}
                ordre={['Nouvelle commande', 'Stock NH', 'Stock Gonnin-Duris', 'Non précisé']}
              />
              <AnneauRepartition
                titre="Reprises par marque"
                donnees={suivi.par_marque_reprise}
                vide="Aucune reprise déclarée."
              />
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
              <h2 className="border-b border-border px-4 py-3 text-sm font-bold uppercase tracking-wider text-gd-navy-dark">
                Déclarations de vente
                <span className="ml-2 font-normal normal-case text-muted-foreground">{declarations.length}</span>
              </h2>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2 text-left font-semibold">Date</th>
                    <th className="px-4 py-2 text-left font-semibold">Vendeur</th>
                    <th className="px-4 py-2 text-left font-semibold">Client</th>
                    <th className="px-4 py-2 text-left font-semibold">Machine</th>
                    <th className="px-4 py-2 text-left font-semibold">Modèle</th>
                    <th className="px-4 py-2 text-left font-semibold">Type</th>
                    <th className="px-4 py-2 text-left font-semibold">Reprise</th>
                  </tr>
                </thead>
                <tbody>
                  {declarations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Aucune déclaration pour l'instant.
                      </td>
                    </tr>
                  ) : (
                    visibles.map((d) => (
                      <tr key={d.id} className="border-b border-border last:border-0 text-sm">
                        <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground">
                          {d.date ? d.date.split('-').reverse().join('/') : '—'}
                        </td>
                        <td className="px-4 py-2 font-semibold text-foreground">{d.vendeur || '—'}</td>
                        <td className="px-4 py-2 text-foreground">{d.client || '—'}</td>
                        <td className="px-4 py-2 text-foreground">{d.machine || '—'}</td>
                        <td className="px-4 py-2 font-semibold text-gd-navy">{d.modele || '—'}</td>
                        <td className="px-4 py-2 text-muted-foreground">{d.type_vente || '—'}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {d.reprise || '—'}{d.marque_reprise ? ` · ${d.marque_reprise}` : ''}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {declarations.length > 10 && (
                <button
                  type="button"
                  onClick={() => setToutVoir((v) => !v)}
                  className="w-full border-t border-border py-3 text-sm font-semibold text-gd-navy transition-colors hover:bg-muted/50"
                >
                  {toutVoir ? 'Réduire' : `Voir la suite (${declarations.length - 10})`}
                </button>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground/40">
              Cette page s'actualise toute seule, chaque minute.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
