// Suivi atelier de l'opération 50 ans.
//
// Le rendez-vous atelier ne se prend plus tout de suite : le référent d'atelier
// marque d'un clic l'issue de son appel, « OK pour un RDV » ou « REFUS ». Les deux
// marques se CUMULENT avec les suivis déjà obtenus (RDV commercial, ou autre) : le
// statut courant dit où en est le suivi, et chaque suivi posé reste mentionné sur la
// fiche client.
export const STATUT_ATELIER = "Contacté par l'atelier OK pour un RDV";
export const STATUT_ATELIER_REFUS = "Contacté par l'atelier REFUS";

// Les deux issues possibles du contact atelier : le référent en marque une seule.
export const ISSUES_ATELIER = [STATUT_ATELIER, STATUT_ATELIER_REFUS];

// Le contact atelier a-t-il déjà été marqué sur ce client (dans un sens ou dans
// l'autre) ? Un clic par client : c'est ce marquage qui compte les prises de contact
// atelier, il ne doit donc jamais pouvoir être posé deux fois.
export const contactAtelierPose = (client) =>
  ISSUES_ATELIER.includes(client?.statut) ||
  (Array.isArray(client?.rdv_obtenus) && ISSUES_ATELIER.some((s) => client.rdv_obtenus.includes(s)));

// Mise à jour d'un client après ce marquage : le statut posé devient le statut
// courant et s'ajoute aux suivis obtenus, sans jamais en effacer un seul. Le suivi
// en cours (RDV commercial, RDV atelier, agri. précision) est d'abord mentionné,
// puisque le statut ne peut en garder qu'un à la fois.
export const updatesApresStatutAtelier = (client, statut = STATUT_ATELIER) => {
  const obtenus = Array.isArray(client?.rdv_obtenus) ? [...client.rdv_obtenus] : [];
  const courant = client?.statut;
  if (courant && !ISSUES_ATELIER.includes(courant) && String(courant).startsWith('RDV ') && !obtenus.includes(courant)) {
    obtenus.push(courant);
  }
  if (!obtenus.includes(statut)) obtenus.push(statut);
  return {
    statut,
    date_dernier_contact: new Date().toISOString().slice(0, 10),
    rdv_obtenus: obtenus
  };
};