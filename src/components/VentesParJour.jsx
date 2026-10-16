import React from 'react';
import { CalendarDays } from 'lucide-react';

/**
 * Rythme des ventes, jour par jour.
 *
 * L'axe du temps est CONTINU : chaque jour de l'opération a sa barre, y
 * compris ceux sans vente. Un graphique qui n'afficherait que les jours
 * remplis donnerait un rythme flatteur et faux — les trous sont précisément
 * ce qu'on veut voir.
 *
 * Les jours à venir sont dessinés en creux, pour qu'un dimanche encore devant
 * nous ne se lise pas comme un dimanche manqué.
 *
 * Le repère est la date de vente annoncée par le vendeur sur le groupe, pas la
 * date d'import : c'est le jour où l'affaire s'est faite.
 */

const JOURS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const jourISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function VentesParJour({ parJour, debut, fin }) {
  const compte = parJour || {};
  const jours = [];

  // Fenêtre affichée : la période de l'opération si elle est connue, sinon
  // l'étendue de ce qui a été déclaré.
  const cles = Object.keys(compte).sort();
  const premier = debut || cles[0];
  const dernier = fin || cles[cles.length - 1];
  if (premier && dernier) {
    const curseur = new Date(`${premier}T12:00:00`);
    const borne = new Date(`${dernier}T12:00:00`);
    // Garde-fou : une période aberrante ne doit pas faire boucler la page.
    for (let i = 0; curseur <= borne && i < 200; i++) {
      const iso = jourISO(curseur);
      jours.push({ iso, date: new Date(curseur), n: compte[iso] || 0 });
      curseur.setDate(curseur.getDate() + 1);
    }
  }

  const total = jours.reduce((s, j) => s + j.n, 0);
  const haut = Math.max(1, ...jours.map((j) => j.n));
  const auj = jourISO(new Date());
  const meilleur = jours.filter((j) => j.n === haut && j.n > 0).map((j) => j.iso);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gd-navy-dark">
          <CalendarDays className="h-4 w-4 text-gd-orange" />
          Ventes par jour
        </h2>
        {total > 0 && (
          <p className="text-xs text-muted-foreground">
            {total} vente{total > 1 ? 's' : ''} · meilleur jour&nbsp;: <span className="font-bold text-gd-navy-dark">{haut}</span>
          </p>
        )}
      </div>

      {jours.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune vente déclarée pour l'instant.</p>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max items-end gap-1.5">
            {jours.map((j) => {
              const avenir = j.iso > auj;
              const cejour = j.iso === auj;
              const record = meilleur.includes(j.iso);
              return (
                <div key={j.iso} className="flex w-9 flex-col items-center gap-1">
                  <span className={`text-xs font-bold tabular-nums ${j.n > 0 ? 'text-gd-navy-dark' : 'text-transparent'}`}>
                    {j.n || 0}
                  </span>
                  <div className="flex h-28 w-full items-end" title={`${j.date.toLocaleDateString('fr-FR')} — ${j.n} vente${j.n > 1 ? 's' : ''}`}>
                    <div
                      className={`w-full rounded-t transition-all ${
                        j.n === 0
                          ? `border border-dashed ${avenir ? 'border-border' : 'border-gd-navy/25'} bg-transparent`
                          : record
                            ? 'bg-gd-orange'
                            : 'bg-gd-navy'
                      }`}
                      style={{ height: j.n === 0 ? '6px' : `${Math.max(8, (j.n / haut) * 100)}%` }}
                    />
                  </div>
                  <span className={`text-[10px] leading-none ${cejour ? 'font-extrabold text-gd-orange' : 'text-muted-foreground'}`}>
                    {JOURS[j.date.getDay()]}
                  </span>
                  <span className={`text-[11px] leading-none tabular-nums ${cejour ? 'font-extrabold text-gd-orange' : 'text-muted-foreground'}`}>
                    {j.date.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
