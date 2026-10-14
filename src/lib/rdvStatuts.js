import { STATUT_ATELIER, STATUT_ATELIER_REFUS } from '@/lib/statutsAtelier';

// Statuts de rendez-vous : prendre le rendez-vous, c'est l'avoir obtenu.
//
// Un client peut cumuler les RDV : à un RDV commercial peut s'ajouter un RDV
// atelier (hivernage) ou un RDV agriculture de précision. `client.statut` garde
// le dernier RDV pris (statut courant du suivi), tandis que `client.rdv_obtenus`
// conserve TOUS les RDV obtenus : chaque RDV pris reste ainsi mentionné sur la
// fiche client et dans les listes.

export const STATUT_PAR_TYPE = {
  'RDV atelier hivernage': 'RDV Atelier obtenu',
  'RDV agri. précision': 'RDV Agri. précision obtenu'
};

// Mentions de la partie atelier : rendez-vous atelier, agri. précision, et les
// statuts du suivi atelier (client contacté, d'accord pour un rendez-vous ou non).
export const STATUTS_ATELIER = ['RDV Atelier obtenu', 'RDV Agri. précision obtenu', STATUT_ATELIER, STATUT_ATELIER_REFUS];

export const statutDuRdv = (type) => STATUT_PAR_TYPE[type] || 'RDV Commercial obtenu';

// Statut du client après la prise d'un rendez-vous. Un statut de RDV déjà obtenu
// n'est JAMAIS écrasé : un RDV commercial reste affiché, et le nouveau rendez-vous
// (atelier ou agri. précision) s'ajoute en mention à côté. Le statut ne bascule sur
// le RDV pris que si le client n'avait pas encore de rendez-vous.
export const statutApresRdv = (client, type) =>
  String(client?.statut || '').startsWith('RDV ') ? client.statut : statutDuRdv(type);

// Liste des RDV obtenus, complétée (sans doublon) par le RDV qui vient d'être pris.
export const rdvObtenus = (client, type) => {
  const obtenus = Array.isArray(client?.rdv_obtenus) ? client.rdv_obtenus : [];
  const statut = statutDuRdv(type);
  return obtenus.includes(statut) ? obtenus : [...obtenus, statut];
};