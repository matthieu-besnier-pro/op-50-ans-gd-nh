import React from 'react';
import { Trophy, Users, Building2, User } from 'lucide-react';

// Deux habillages : 'dark' (espaces collaborateur, fond navy) et 'light' (tableau de bord).
const THEMES = {
  dark: {
    card: 'rounded-xl border border-white/10 bg-white/5',
    titre: 'text-gd-orange',
    label: 'text-white/60',
    valeur: 'text-white',
    objectif: 'text-white/50',
    bar: 'bg-white/10',
    fill: 'bg-gd-orange',
    ligneMoi: 'bg-gd-orange/20 border-gd-orange/40',
    ligne: 'bg-white/5 border-white/10',
    texte: 'text-white',
    sub: 'text-white/50'
  },
  light: {
    card: 'rounded-xl border border-border bg-card',
    titre: 'text-gd-navy',
    label: 'text-muted-foreground',
    valeur: 'text-gd-navy-dark',
    objectif: 'text-muted-foreground',
    bar: 'bg-muted',
    fill: 'bg-gd-orange',
    ligneMoi: 'bg-gd-orange/20 border-gd-orange/50',
    ligne: 'bg-muted/40 border-border',
    texte: 'text-foreground',
    sub: 'text-muted-foreground'
  }
};

export default function RdvNiveaux({ niveaux, variant = 'light' }) {
  const t = THEMES[variant] || THEMES.light;

  const cartes = [
    { cle: 'moi', icone: User, titre: 'Moi', valeur: niveaux.moi, objectif: 0, sub: 'mes RDV pris' },
    { cle: 'equipe', icone: Users, titre: 'Mon équipe', valeur: niveaux.equipe, objectif: 0, sub: niveaux.tailleEquipe > 1 ? `${niveaux.tailleEquipe} commerciaux` : 'aucune équipe rattachée à votre compte' },
    { cle: 'entreprise', icone: Building2, titre: "L'entreprise", valeur: niveaux.entreprise, objectif: niveaux.objectifEntreprise, sub: "toute l'opération" }
  ];

  const top = niveaux.classement.slice(0, 5);
  const maLigne = top.some((e) => e.nom === niveaux.monNom)
    ? null
    : niveaux.classement.find((e) => e.nom === niveaux.monNom);

  return (
    <div className={`${t.card} p-4`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${t.titre}`}>
          <Trophy className="h-3.5 w-3.5" /> RDV — moi · mon équipe · l'entreprise
        </h2>
        {niveaux.monRang && (
          <span className={`text-xs font-semibold ${t.sub}`}>
            Ma position : {niveaux.monRang}<sup>e</sup> sur {niveaux.totalParticipants}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cartes.map((c) => {
          const Icone = c.icone;
          const pct = c.valeur !== null && c.objectif > 0 ? Math.min((c.valeur / c.objectif) * 100, 100) : 0;
          return (
            <div key={c.cle} className={`rounded-lg border p-3 ${t.ligne}`}>
              <p className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${t.label}`}>
                <Icone className="h-3.5 w-3.5" /> {c.titre}
              </p>
              <p className={`mt-1 text-2xl font-extrabold tabular-nums ${t.valeur}`}>
                {c.valeur === null ? '—' : c.valeur}
                {c.valeur !== null && c.objectif > 0 && (
                  <span className={`ml-1 text-xs font-semibold ${t.objectif}`}>/ {c.objectif}</span>
                )}
              </p>
              {c.valeur !== null && c.objectif > 0 && (
                <div className={`mt-1.5 h-1.5 overflow-hidden rounded-full ${t.bar}`}>
                  <div className={`h-full rounded-full transition-all duration-700 ${t.fill}`} style={{ width: `${pct}%` }} />
                </div>
              )}
              <p className={`mt-1 text-[10px] ${t.sub}`}>{c.sub}</p>
            </div>
          );
        })}
      </div>

      {niveaux.classement.length > 0 && (
        <div className="mt-4">
          <p className={`mb-1.5 text-[10px] font-bold uppercase tracking-widest ${t.sub}`}>Classement RDV</p>
          <div className="space-y-1.5">
            {[...top, ...(maLigne ? [maLigne] : [])].map((e) => {
              const rang = niveaux.classement.indexOf(e) + 1;
              const moi = e.nom === niveaux.monNom;
              return (
                <div key={e.nom} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${moi ? t.ligneMoi : t.ligne}`}>
                  <span className={`w-6 text-xs font-bold tabular-nums ${t.valeur}`}>#{rang}</span>
                  <span className={`flex-1 truncate text-xs font-medium ${t.texte}`}>{e.nom}{moi ? ' (vous)' : ''}</span>
                  <span className={`text-xs font-extrabold tabular-nums ${t.valeur}`}>{e.rdv}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}