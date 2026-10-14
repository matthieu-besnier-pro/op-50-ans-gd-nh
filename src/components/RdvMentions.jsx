import React from 'react';
import { CalendarCheck, Sprout, Wrench } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { STATUTS_ATELIER } from '@/lib/rdvStatuts';

// RDV déjà obtenus sur un client. Un client peut cumuler un RDV commercial ET un
// RDV atelier ou agri. précision : chaque RDV pris reste mentionné, même quand un
// nouveau rendez-vous a changé le statut courant du client.
export default function RdvMentions({ client, className = '' }) {
  const obtenus = Array.isArray(client?.rdv_obtenus) ? client.rdv_obtenus : [];
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