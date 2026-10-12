// Nom du commercial à qui appartient un RDV (ou une vente).
// La fiche fait foi : un RDV peut porter l'ID du compte (compte lié) ou celui de la fiche.
// Portefeuilles partagés (doublons de secteur) : c'est ce nom qui dissocie l'un de l'autre.
export function nomCommercial(commercialId, structure = []) {
  if (!commercialId) return '';
  const fiche = structure.find((s) => s.id === commercialId || s.user_id === commercialId);
  return fiche?.nom_commercial || '';
}