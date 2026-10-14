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

// Les deux statuts de la partie atelier.
export const STATUTS_ATELIER = ['RDV Atelier obtenu', 'RDV Agri. précision obtenu'];

export const statutDuRdv = (type) => STATUT_PAR_TYPE[type] || 'RDV Commercial obtenu';

// Liste des RDV obtenus, complétée (sans doublon) par le RDV qui vient d'être pris.
export const rdvObtenus = (client, type) => {
  const obtenus = Array.isArray(client?.rdv_obtenus) ? client.rdv_obtenus : [];
  const statut = statutDuRdv(type);
  return obtenus.includes(statut) ? obtenus : [...obtenus, statut];
};