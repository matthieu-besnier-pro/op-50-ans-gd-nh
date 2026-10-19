import React from 'react';
import { Droplets, Trophy } from 'lucide-react';
import { COLONNES, LIGNES, parPointDeVente, TOTAL_KG } from '@/lib/televenteOuest';

/**
 * Télévente HUILE & GRAISSE — résultats du secteur Ouest, par point de vente.
 *
 * Le classement passe avant le détail : la question posée est « qui a vendu
 * combien, et où ». Le tableau produit par produit vient ensuite, pour ceux
 * qui veulent savoir ce qui s'est vendu plutôt que combien.
 *
 * Les quantités sont des contenants, le total est en kilos — un carton de
 * graisse et un fût de 209 litres ne pèsent pas la même chose, les additionner
 * en « nombre de pièces » ne voudrait rien dire.
 */

const kg = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
const familles = [...new Set(COLONNES.map((c) => c.famille))];

export default function TeleventeOuest({ titre = 'Télévente Huile & Graisse — Ouest' }) {
  const sites = parPointDeVente();
  const haut = Math.max(...sites.map((s) => s.kg), 1);
  const totaux = {};
  COLONNES.forEach(({ cle }) => { totaux[cle] = LIGNES.reduce((s, l) => s + (l[cle] || 0), 0); });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gd-orange/40 bg-gd-orange/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <Droplets className="h-7 w-7 shrink-0 text-gd-orange" />
          <div>
            <h2 className="text-base font-extrabold text-gd-navy-dark">{titre}</h2>
            <p className="text-xs text-muted-foreground">
              {sites.length} points de vente · {LIGNES.length} vendeurs
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold tabular-nums leading-none text-gd-navy-dark">
            {(TOTAL_KG / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} T
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gd-orange">Plus de 30 tonnes vendues</p>
        </div>
      </div>

      {/* Classement par point de vente : la barre se lit avant le chiffre. */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gd-navy-dark">
          <Trophy className="h-4 w-4 text-gd-orange" />
          Par point de vente
        </h3>
        <ul className="space-y-2.5">
          {sites.map((s, i) => (
            <li key={s.site} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-right text-xs font-bold tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="w-44 shrink-0 truncate text-sm font-semibold text-foreground" title={s.site}>{s.site}</span>
              <span className="h-5 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={`block h-full rounded-full ${i === 0 ? 'bg-gd-orange' : 'bg-gd-navy'}`}
                  style={{ width: `${Math.max(4, (s.kg / haut) * 100)}%` }}
                />
              </span>
              <span className="w-24 shrink-0 text-right text-sm font-extrabold tabular-nums text-gd-navy-dark">
                {kg(s.kg)} kg
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Détail produit par produit, dans la maille du relevé de télévente. */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs">
              <th className="px-3 py-2 text-left font-semibold">Point de vente</th>
              <th className="px-3 py-2 text-left font-semibold">Vendeur</th>
              {familles.map((f) => (
                <th
                  key={f}
                  colSpan={COLONNES.filter((c) => c.famille === f).length}
                  className="border-l border-border px-3 py-2 text-center font-bold uppercase tracking-wider text-gd-navy"
                >
                  {f}
                </th>
              ))}
              <th className="border-l border-border px-3 py-2 text-right font-semibold">Total</th>
            </tr>
            <tr className="border-b border-border bg-muted/20 text-[11px] text-muted-foreground">
              <th className="px-3 py-1.5" />
              <th className="px-3 py-1.5" />
              {COLONNES.map((c, i) => (
                <th
                  key={c.cle}
                  className={`px-3 py-1.5 text-center font-medium ${
                    i === 0 || COLONNES[i - 1]?.famille !== c.famille ? 'border-l border-border' : ''
                  }`}
                >
                  {c.libelle}
                </th>
              ))}
              <th className="border-l border-border px-3 py-1.5 text-right font-medium">kg</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) =>
              s.vendeurs.map((l, idx) => (
                <tr key={`${s.site}-${l.vendeur}`} className="border-b border-border last:border-0 text-sm hover:bg-muted/30">
                  {/* Le point de vente n'est écrit qu'une fois : le répéter sur
                      chaque vendeur brouillerait le regroupement. */}
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-gd-navy">
                    {idx === 0 ? s.site : ''}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground">{l.vendeur}</td>
                  {COLONNES.map((c, i) => (
                    <td
                      key={c.cle}
                      className={`px-3 py-2 text-center tabular-nums ${
                        l[c.cle] ? 'text-foreground' : 'text-muted-foreground/40'
                      } ${i === 0 || COLONNES[i - 1]?.famille !== c.famille ? 'border-l border-border' : ''}`}
                    >
                      {l[c.cle] || '—'}
                    </td>
                  ))}
                  <td className="border-l border-border px-3 py-2 text-right font-bold tabular-nums text-gd-navy-dark">
                    {kg(l.kg)}
                  </td>
                </tr>
              ))
            )}
            <tr className="border-t-2 border-gd-navy/20 bg-muted/40 text-sm">
              <td className="px-3 py-2.5 font-extrabold uppercase text-gd-navy-dark" colSpan={2}>Total</td>
              {COLONNES.map((c, i) => (
                <td
                  key={c.cle}
                  className={`px-3 py-2.5 text-center font-bold tabular-nums text-gd-navy-dark ${
                    i === 0 || COLONNES[i - 1]?.famille !== c.famille ? 'border-l border-border' : ''
                  }`}
                >
                  {totaux[c.cle] || '—'}
                </td>
              ))}
              <td className="border-l border-border px-3 py-2.5 text-right text-base font-extrabold tabular-nums text-gd-orange">
                {kg(TOTAL_KG)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
