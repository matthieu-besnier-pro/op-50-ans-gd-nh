import React from 'react';
import { Clock } from 'lucide-react';

/**
 * Date et heure courantes, pour horodater une capture d'écran.
 *
 * Elle ne dit rien des données — c'est l'heure de la pendule, pas celle de la
 * dernière remontée WhatsApp, qui est annoncée séparément dans le bandeau
 * d'échéance. Les deux coexistent sans se contredire : l'une date la photo,
 * l'autre date le contenu.
 *
 * Elle avance seule, à la minute. C'est le seul rafraîchissement automatique
 * de la page : il ne recharge aucun chiffre, il fait seulement que la capture
 * prise à 14h32 porte bien 14h32.
 */

const JOUR = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

export default function HorlogeEcran({ className = '' }) {
  const [maintenant, setMaintenant] = React.useState(() => new Date());

  React.useEffect(() => {
    // Calé sur le début de la minute suivante : l'affichage change à la
    // seconde où la minute tourne, pas trente secondes plus tard.
    let minuterie;
    const planifier = () => {
      const reste = 60000 - (Date.now() % 60000);
      minuterie = setTimeout(() => {
        setMaintenant(new Date());
        planifier();
      }, reste + 50);
    };
    planifier();
    return () => clearTimeout(minuterie);
  }, []);

  return (
    <p className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span className="first-letter:uppercase">{maintenant.toLocaleDateString('fr-FR', JOUR)}</span>
      <span className="font-bold tabular-nums text-gd-navy-dark">
        {maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')}
      </span>
    </p>
  );
}
