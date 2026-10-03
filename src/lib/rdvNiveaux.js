// Indicateurs RDV à trois niveaux : moi / mon équipe / l'entreprise.
// « RDV pris » = RDV du mois en cours, hors RDV annulés (comptés dès la prise de rendez-vous).

const idsDeFiche = (fiche) => [fiche?.id, fiche?.user_id].filter(Boolean);

export function computeRdvNiveaux({ rdvs = [], structure = [], users = [], user, objectifRdv = 0 }) {
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const rdvsPris = rdvs.filter((r) => r.commercial_id && r.statut !== 'Annulé' && r.date_heure >= debutMois);

  // Une personne est identifiée soit par son compte, soit par sa fiche commerciale (les RDV peuvent porter l'un ou l'autre).
  const normaliser = (v) => String(v || '').trim().toLowerCase();
  const maFiche = structure.find((s) => s.user_id && s.user_id === user?.id)
    || structure.find((s) => s.email && user?.email && normaliser(s.email) === normaliser(user.email))
    || structure.find((s) => s.nom_commercial && user?.full_name && normaliser(s.nom_commercial) === normaliser(user.full_name));
  const mesIds = [...new Set([user?.id, ...idsDeFiche(maFiche)])];

  const equipe = maFiche?.manager ? structure.filter((s) => s.manager === maFiche.manager) : [];
  const idsEquipe = [...new Set(equipe.flatMap(idsDeFiche))];

  const nomDe = (commercialId) => {
    const fiche = structure.find((s) => idsDeFiche(s).includes(commercialId));
    return fiche?.nom_commercial || users.find((u) => u.id === commercialId)?.full_name || 'Commercial';
  };

  const parNom = new Map();
  rdvsPris.forEach((r) => {
    const nom = nomDe(r.commercial_id);
    parNom.set(nom, (parNom.get(nom) || 0) + 1);
  });
  const classement = [...parNom.entries()]
    .map(([nom, rdv]) => ({ nom, rdv }))
    .sort((a, b) => b.rdv - a.rdv);

  const monNom = maFiche?.nom_commercial || user?.full_name || '';
  const indexMoi = classement.findIndex((e) => e.nom === monNom);

  // L'objectif RDV est un objectif GLOBAL : il ne se divise pas par personne.
  return {
    moi: rdvsPris.filter((r) => mesIds.includes(r.commercial_id)).length,
    equipe: equipe.length > 1 ? rdvsPris.filter((r) => idsEquipe.includes(r.commercial_id)).length : null,
    tailleEquipe: equipe.length,
    entreprise: rdvsPris.length,
    objectifEntreprise: objectifRdv || 0,
    classement,
    monNom,
    monRang: indexMoi >= 0 ? indexMoi + 1 : null,
    totalParticipants: classement.length
  };
}