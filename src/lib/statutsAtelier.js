// Suivi atelier de l'opération 50 ans.
//
// Le rendez-vous atelier ne se prend plus tout de suite : le référent d'atelier
// pose un seul statut, « Contacté par l'atelier OK pour un RDV ». Il se CUMULE avec
// les suivis déjà obtenus (RDV commercial, ou autre) : le statut courant dit où en
// est le suivi, et chaque suivi posé reste mentionné sur la fiche client.
export const STATUT_ATELIER = "Contacté par l'atelier OK pour un RDV";

// La prise de contact atelier a-t-elle déjà été posée sur ce client ? Un clic par
// client : c'est ce marquage qui compte les prises de contact atelier, il ne doit
// donc jamais pouvoir être posé deux fois.
export const contactAtelierPose = (client) =>
  client?.statut === STATUT_ATELIER || (Array.isArray(client?.rdv_obtenus) && client.rdv_obtenus.includes(STATUT_ATELIER));

// Mise à jour d'un client après ce statut : il devient le statut courant et s'ajoute
// aux suivis obtenus, sans jamais en effacer un seul. Le suivi en cours (RDV
// commercial, RDV atelier, agri. précision) est d'abord mentionné, puisque le statut
// ne peut en garder qu'un à la fois.
export const updatesApresStatutAtelier = (client) => {
  const obtenus = Array.isArray(client?.rdv_obtenus) ? [...client.rdv_obtenus] : [];
  const courant = client?.statut;
  if (courant && courant !== STATUT_ATELIER && String(courant).startsWith('RDV ') && !obtenus.includes(courant)) {
    obtenus.push(courant);
  }
  if (!obtenus.includes(STATUT_ATELIER)) obtenus.push(STATUT_ATELIER);
  return {
    statut: STATUT_ATELIER,
    date_dernier_contact: new Date().toISOString().slice(0, 10),
    rdv_obtenus: obtenus
  };
};