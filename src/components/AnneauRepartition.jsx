import React from 'react';

/**
 * Répartition en anneau.
 *
 * Dessiné en SVG, sans bibliothèque : un cercle dont on découpe le contour en
 * arcs proportionnels. La légende porte les chiffres, l'anneau les proportions
 * — on lit l'un ou l'autre selon ce qu'on cherche, sans avoir à survoler quoi
 * que ce soit, ce qui compte sur un tableau projeté ou partagé.
 */

// Marine pour commencer, orange pour ce qui doit sauter aux yeux, puis des
// teintes qui se distinguent les unes des autres même côte à côte.
const COULEURS = [
  'hsl(212 100% 21%)',
  'hsl(45 100% 51%)',
  'hsl(199 89% 48%)',
  'hsl(160 84% 39%)',
  'hsl(271 81% 56%)',
  'hsl(0 72% 51%)',
  'hsl(25 95% 53%)',
  'hsl(190 95% 39%)',
  'hsl(330 81% 60%)',
  'hsl(212 25% 55%)'
];

export default function AnneauRepartition({ titre, donnees, vide = 'Aucune donnée.' }) {
  const entrees = Object.entries(donnees || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = entrees.reduce((s, [, n]) => s + n, 0);

  // Rayon et circonférence du tracé : les arcs se posent dessus par décalage.
  const R = 54;
  const C = 2 * Math.PI * R;
  let avance = 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gd-navy-dark">{titre}</h2>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">{vide}</p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90">
            <circle cx="70" cy="70" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="18" />
            {entrees.map(([cle, n], i) => {
              const part = (n / total) * C;
              const decalage = avance;
              avance += part;
              return (
                <circle
                  key={cle}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke={COULEURS[i % COULEURS.length]}
                  strokeWidth="18"
                  strokeDasharray={`${part} ${C - part}`}
                  strokeDashoffset={-decalage}
                />
              );
            })}
            {/* Le total au centre : c'est la première chose qu'on cherche. */}
            <text
              x="70"
              y="70"
              textAnchor="middle"
              dominantBaseline="central"
              transform="rotate(90 70 70)"
              className="fill-gd-navy-dark text-2xl font-extrabold"
            >
              {total}
            </text>
          </svg>

          <ul className="w-full space-y-1.5">
            {entrees.map(([cle, n], i) => (
              <li key={cle} className="flex items-center gap-2 text-sm">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: COULEURS[i % COULEURS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-foreground">{cle}</span>
                <span className="font-bold tabular-nums text-gd-navy-dark">{n}</span>
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                  {Math.round((n / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
