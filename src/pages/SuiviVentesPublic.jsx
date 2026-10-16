import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import MachineIcone from '@/components/MachineIcone';
import OpLogo from '@/components/OpLogo';
import MACHINES from '@/lib/famillesMachines';

/**
 * Suivi des ventes — vue PUBLIQUE.
 *
 * Consultable sans compte, sans menu : la page se suffit à elle-même. Elle
 * n'affiche que des agrégats — ventes par vendeur et par famille, taux de
 * transformation. Aucun nom de client, aucune fiche : ce qui appartient à un
 * tiers ne sort pas par cette porte.
 */

function Repartition({ titre, donnees, ordre }) {
  const entrees = (ordre || Object.keys(donnees || {}))
    .map((cle) => [cle, (donnees || {})[cle] || 0])
    .filter(([, n]) => n > 0);
  const total = entrees.reduce((s, [, n]) => s + n, 0);
  if (entrees.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/70">{titre}</h2>
      <div className="space-y-2">
        {entrees.map(([cle, n]) => (
          <div key={cle}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-white/80">{cle}</span>
              <span className="font-bold tabular-nums text-white">{n}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
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

  const ventesAgri = totauxMachines['Agri. précision'] || 0;
  const ventesMateriel = Math.max((suivi?.total || 0) - ventesAgri, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gd-navy-dark via-gd-navy to-gd-navy-dark text-white">
      <header className="flex items-center gap-4 border-b border-white/10 px-6 py-5">
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
          <p className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/70">{erreur}</p>
        ) : !suivi ? (
          <p className="p-8 text-center text-white/50">Chargement…</p>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-gd-orange/40 bg-gd-orange/10 p-5">
                <p className="text-4xl font-extrabold tabular-nums text-gd-orange">{suivi.total}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/60">Ventes déclarées</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-4xl font-extrabold tabular-nums text-white">{suivi.validees}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/60">Validées</p>
              </div>
              {[
                { famille: 'Tracteur', titre: 'Matériel', ventes: ventesMateriel, rdv: suivi.rdv?.materiel || 0 },
                { famille: 'Agri. précision', titre: 'Agri. précision', ventes: ventesAgri, rdv: suivi.rdv?.agri || 0 }
              ].map((u) => {
                const taux = u.rdv > 0 ? Math.round((u.ventes / u.rdv) * 100) : 0;
                return (
                  <div key={u.titre} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-4xl font-extrabold tabular-nums text-white">{taux}%</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/60">
                      Transfo. {u.titre}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/40">{u.ventes} vente(s) / {u.rdv} RDV</p>
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
                      n > 0 ? 'border-gd-orange/40 bg-gd-orange/10' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <MachineIcone
                      famille={m.cle}
                      titre={m.libelle}
                      className={`mx-auto h-14 w-full text-white ${n > 0 ? '' : 'opacity-40 grayscale'}`}
                    />
                    <p className={`mt-1.5 text-2xl font-extrabold tabular-nums ${n > 0 ? 'text-gd-orange' : 'text-white/30'}`}>
                      {n}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase leading-tight tracking-wide text-white/50">
                      {m.libelle}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
                      Vendeur
                    </th>
                    {MACHINES.map((m) => (
                      <th key={m.cle} className="px-3 py-2 text-center align-bottom">
                        <MachineIcone famille={m.cle} titre={m.libelle} className="mx-auto h-9 w-16 text-white" />
                        <span className="mx-auto mt-1 block max-w-[5.5rem] text-[10px] font-semibold uppercase leading-tight tracking-wide text-white/50">
                          {m.libelle}
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white/50">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.length === 0 ? (
                    <tr>
                      <td colSpan={MACHINES.length + 2} className="px-4 py-12 text-center text-sm text-white/50">
                        Aucune vente déclarée pour l'instant.
                      </td>
                    </tr>
                  ) : (
                    lignes.map((l) => (
                      <tr key={l.nom} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-3 text-sm font-semibold">{l.nom}</td>
                        {MACHINES.map((m) => {
                          const n = l.machines[m.cle] || 0;
                          return (
                            <td key={m.cle} className="px-3 py-3 text-center">
                              {n > 0 ? (
                                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-gd-orange px-2 text-sm font-bold tabular-nums text-gd-navy-dark">
                                  {n}
                                </span>
                              ) : (
                                <span className="text-sm text-white/20">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right text-lg font-extrabold tabular-nums text-white">{l.total}</td>
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
              <Repartition
                titre="Répartition des reprises"
                donnees={suivi.par_reprise}
                ordre={['Sans reprise', 'Reprise NH', 'Reprise autre marque', 'Non précisé']}
              />
            </div>

            <p className="mt-6 text-center text-xs text-white/30">
              Mis à jour {data?.maj ? new Date(data.maj).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''} — actualisation automatique
            </p>
          </>
        )}
      </main>
    </div>
  );
}
