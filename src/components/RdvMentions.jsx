import React from 'react';
import { CalendarCheck, Sprout, Wrench } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { STATUTS_ATELIER } from '@/lib/rdvStatuts';

// RDV déjà obtenus sur un client. Un client peut cumuler un RDV commercial ET un
// RDV atelier ou agri. précision : le statut obtenu reste en place et chaque
// rendez-vous pris reste mentionné.
export default function RdvMentions({ client, className = '', complet = false }) {
  const tous = Array.isArray(client?.rdv_obtenus) ? client.rdv_obtenus : [];
  // En liste, la pastille de statut juste au-dessus affiche déjà le statut courant :
  // on ne mentionne que les RDV supplémentaires. Dans les fenêtres de prise de
  // rendez-vous (`complet`), on affiche tout ce qui est déjà obtenu.
  const obtenus = complet ? tous : tous.filter((s) => s !== client?.statut);
  if (obtenus.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {obtenus.map((statut) => {
        const atelier = STATUTS_ATELIER.includes(statut);
        const Icon = statut.includes('Agri') ? Sprout : atelier ? Wrench : CalendarCheck;
        return (
          <StatusBadge key={statut} statut={statut} className="gap-1 px-2 py-0.5 text-[10px]">
            <Icon className="h-3 w-3" />
            {statut}
          </StatusBadge>
        );
      })}
    </div>
  );
}