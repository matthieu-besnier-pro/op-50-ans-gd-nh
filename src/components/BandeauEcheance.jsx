import React from 'react';
import { CalendarClock, MessageSquare } from 'lucide-react';

/**
 * Rappel de l'échéance de l'opération, et dernière remontée du groupe.
 *
 * L'horodatage affiché est celui de la dernière vente déclarée, pas celui du
 * calcul : c'est lui qui dit si le tableau vit. Le suivi papier de 2021 portait
 * déjà cette ligne en tête de ses statistiques.
 *
 * La date affichée est une échéance, pas un couperet : les ventes déclarées
 * après continuent d'être comptées. Ce bandeau ne le dit PAS — c'est une règle
 * interne, qui n'a pas à figurer sur une page ouverte à qui a le lien.
 */

const LONG = { day: 'numeric', month: 'long', year: 'numeric' };

export default function BandeauEcheance({ dateFin, derniere }) {
  const fin = dateFin ? new Date(`${dateFin}T23:59:59`) : null;
  const valide = fin && !Number.isNaN(fin.getTime());

  // Jours restants comptés de DATE à DATE, pas d'heure à heure : le 30 au
  // matin est le dernier jour, pas « J-1 ».
  let reste = null;
  if (valide) {
    const auj = new Date();
    auj.setHours(0, 0, 0, 0);
    const finJour = new Date(`${dateFin}T00:00:00`);
    reste = Math.round((finJour.getTime() - auj.getTime()) / 86400000);
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gd-orange/40 bg-gd-orange/5 px-4 py-3">
      <p className="flex items-center gap-2.5 text-sm font-bold text-gd-navy-dark">
        <CalendarClock className="h-5 w-5 shrink-0 text-gd-orange" />
        {valide ? <>Opération jusqu'au {fin.toLocaleDateString('fr-FR', LONG)}</> : 'Opération en cours'}
        {reste !== null && reste >= 0 && (
          <span className="rounded-full bg-gd-orange px-2 py-0.5 text-xs font-extrabold uppercase text-gd-navy-dark">
            {reste === 0 ? 'Dernier jour' : `J-${reste}`}
          </span>
        )}
      </p>
      {derniere?.quand && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
          <span>
            Dernière déclaration
            {derniere.vendeur ? <> — <span className="font-semibold text-foreground">{derniere.vendeur}</span></> : null}
            {derniere.modele || derniere.machine ? ` · ${derniere.modele || derniere.machine}` : ''}
            {' le '}
            {new Date(derniere.quand).toLocaleDateString('fr-FR')} à{' '}
            {new Date(derniere.quand).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </p>
      )}
    </div>
  );
}
