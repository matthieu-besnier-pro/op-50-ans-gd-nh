// Suivi atelier de l'opération 50 ans.
//
// Le rendez-vous atelier ne se prend plus tout de suite : le référent d'atelier
// trace d'abord le contact, puis l'accord du client. Ces deux marques se CUMULENT
// avec les suivis déjà obtenus (RDV commercial, ou autre) : le statut courant dit
// où en est le suivi, et chaque marque posée reste mentionnée sur la fiche.
export const MARQUES_ATELIER = [
  { nom: "Contacté par l'atelier", aide: "Le client a été appelé par l'atelier." },
  { nom: 'OK pour un RDV', aide: "Le client est d'accord pour un rendez-vous." }
];

export const NOMS_MARQUES_ATELIER = MARQUES_ATELIER.map((m) => m.nom);

export const estMarqueAtelier = (nom) => NOMS_MARQUES_ATELIER.includes(nom);

// Mise à jour d'un client après une marque atelier : la marque devient le statut
// courant et s'ajoute aux suivis obtenus, sans jamais en effacer un seul. Le suivi
// en cours (RDV commercial, RDV atelier, agri. précision ou autre marque) est
// d'abord mentionné, puisque le statut ne peut en garder qu'un à la fois.
export const updatesApresMarque = (client, marque) => {
  const obtenus = Array.isArray(client?.rdv_obtenus) ? [...client.rdv_obtenus] : [];
  const courant = client?.statut;
  const suivi = !!courant && (String(courant).startsWith('RDV ') || estMarqueAtelier(courant));
  if (suivi && courant !== marque && !obtenus.includes(courant)) obtenus.push(courant);
  if (!obtenus.includes(marque)) obtenus.push(marque);
  return {
    statut: marque,
    date_dernier_contact: new Date().toISOString().slice(0, 10),
    rdv_obtenus: obtenus
  };
};