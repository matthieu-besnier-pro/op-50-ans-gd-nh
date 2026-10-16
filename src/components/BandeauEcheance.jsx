import React from 'react';
import { CalendarClock, MessageSquare } from 'lucide-react';

/**
 * Rappel de l'échéance de l'opération, et état des remontées WhatsApp.
 *
 * Deux horodatages sont en jeu, et confondre les deux crée de la frustration :
 *
 *   - la date de la VENTE, telle que le vendeur l'a déclarée sur le groupe ;
 *   - l'heure d'INTÉGRATION, à laquelle cette déclaration est entrée dans
 *     l'outil par un import.
 *
 * C'est la seconde qui est annoncée en premier, parce que c'est elle qui dit
 * jusqu'où le tableau est à jour. Une vente déclarée sur WhatsApp après cette
 * heure n'est pas encore comptée — ce n'est pas une anomalie, c'est un import
 * qui reste à faire, et le bandeau doit le dire plutôt que de laisser croire à
 * un chiffre faux.
 *
 * La date de fin affichée est une échéance, pas un couperet : les ventes
 * déclarées après continuent d'être comptées. Ce bandeau ne le dit PAS —
 * c'est une règle interne, qui n'a pas à figurer sur une page ouverte à qui a
 * le lien.
 */

const LONG = { day: 'numeric', month: 'long', year: 'numeric' };
const COURT = { day: '2-digit', month: '2-digit' };
const HEURE = { hour: '2-digit', minute: '2-digit' };

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

  const integre = derniere?.integre ? new Date(derniere.integre) : null;
  const integreOk = integre && !Number.isNaN(integre.getTime());
  const vente = derniere?.quand ? new Date(`${String(derniere.quand).slice(0, 10)}T12:00:00`) : null;
  const venteOk = vente && !Number.isNaN(vente.getTime());
  const quoi = derniere?.modele || derniere?.machine || '';

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gd-orange/40 bg-gd-orange/5 px-4 py-3">
      <p className="flex items-center gap-2.5 text-sm font-bold text-gd-navy-dark">
        <CalendarClock className="h-5 w-5 shrink-0 text-gd-orange" />
        {valide ? <>Opération jusqu'au {fin.toLocaleDateString('fr-FR', LONG)}</> : 'Opération en cours'}
        {reste !== null && reste >= 0 && (
          <span className="rounded-full bg-gd-orange px-2 py-0.5 text-xs font-extrabold uppercase text-gd-navy-dark">
            {reste === 0 ? 'Dernier jour' : `J-${reste}`}
          </span>
        )}
      </p>

      {integreOk && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="leading-relaxed">
            Remontées WhatsApp intégrées jusqu'au{' '}
            <span className="font-bold text-foreground">
              {integre.toLocaleDateString('fr-FR', COURT)} à {integre.toLocaleTimeString('fr-FR', HEURE)}
            </span>
            {/* Ce qui a été intégré en dernier : de quoi reconnaître d'un coup
                d'œil si sa propre déclaration est passée, ou attend encore. */}
            {(derniere?.vendeur || quoi) && (
              <>
                <br />
                <span className="text-muted-foreground">
                  Dernière : {derniere?.vendeur || 'vendeur non précisé'}
                  {quoi ? ` · ${quoi}` : ''}
                  {venteOk ? ` (vente du ${vente.toLocaleDateString('fr-FR', COURT)})` : ''}
                </span>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
