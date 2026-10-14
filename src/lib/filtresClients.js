// Filtres de liste clients, partagés par le portefeuille commercial (« Mes clients »)
// et la liste de travail SAV : mêmes critères, même comportement des deux côtés.

// Filtres au repos (aucun filtre actif).
export const FILTRES_CLIENT_INIT = {
  search: '',
  statut: 'all',
  appetence: 'all',
  commercial: 'all',
  suivi: 'all',
  parc: 'all',
  agri: 'all',
  site: 'all'
};

// Catégories de machines présentes dans le parc d'un client (« TRACTEURS:3 »).
export const categoriesDuParc = (client) =>
  (client.parc_pictos || [])
    .map((p) => { const [cat, n] = String(p).split(':'); return (Number(n) || 0) > 0 ? cat : null; })
    .filter(Boolean);

// Niveau d'appétence du client (mêmes seuils que la jauge AppetenceGauge).
export const niveauAppetence = (client) => {
  if (client.niveau_appetence) return client.niveau_appetence;
  const s = client.score_appetence;
  if (s == null) return null;
  if (s >= 66) return 'Fort';
  if (s >= 36) return 'Moyen';
  return 'Faible';
};

const actif = (v) => v !== undefined && v !== null && v !== '' && v !== 'all';

// Un client passe-t-il tous les filtres actifs ? Les filtres absents ou à « all »
// sont ignorés, ce qui permet aux écrans de n'utiliser que ceux qui les concernent.
// `nomsCommerciaux` complète la recherche (noms des commerciaux assignés).
export function clientPasseFiltres(client, filters = {}, { nomsCommerciaux = '' } = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parc cible : ne garder que les clients possédant ce type de machine.
  if (actif(filters.parc) && !categoriesDuParc(client).includes(filters.parc)) return false;

  // Agriculture de précision : d'où vient le ciblage (tracteurs AGP, CX 5/6, Trimble).
  if (actif(filters.agri) && !(client.sources_agri_precision || []).includes(filters.agri)) return false;

  if (actif(filters.statut) && client.statut !== filters.statut) return false;
  if (actif(filters.appetence) && niveauAppetence(client) !== filters.appetence) return false;

  // Site de rattachement (liste SAV : cibles du fichier atelier).
  if (actif(filters.site) && (client.site_atelier || '') !== filters.site) return false;

  if (actif(filters.commercial)) {
    const assigned = client.commerciaux_assignes || [];
    if (String(filters.commercial).startsWith('secteur:')) {
      // Client pas encore rattaché à un compte : on filtre sur le secteur d'import.
      if (assigned.length > 0 || client.secteur !== String(filters.commercial).slice(8)) return false;
    } else if (!assigned.includes(filters.commercial)) return false;
  }

  if (filters.suivi === 'rdv') {
    const next = client.date_prochain_rdv ? new Date(client.date_prochain_rdv) : null;
    if (!next || next < today) return false;
  }
  if (filters.suivi === 'rappel') {
    const rappel = client.date_rappel ? new Date(client.date_rappel) : null;
    if (client.statut !== 'À rappeler' || !rappel || rappel > today) return false;
  }

  if (filters.search) {
    const s = String(filters.search).toLowerCase();
    const hay = [
      client.raison_sociale, client.siren, client.code_commune, client.adresse_complete,
      client.secteur, client.site_atelier, nomsCommerciaux
    ].filter(Boolean).join(' ').toLowerCase();
    if (!hay.includes(s)) return false;
  }

  return true;
}