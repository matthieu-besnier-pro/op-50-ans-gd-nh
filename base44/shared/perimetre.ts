import { comptesDesChefs } from './atelier.ts';
// Périmètre « atelier » — partagé par lister_clients et statistiques_operation.
//
// Un chef d'atelier voit les clients des commerciaux de son site, un responsable SAV
// ceux de ses sites, d'après le tableau de répartition (base.commerciaux × base.chefs_atelier).
// Le rapprochement passe par le nom : les fiches commerciales portent bien
// l'identifiant du compte une fois le commercial connecté, mais les clients d'un
// portefeuille partagé (binôme sur un même secteur) gardent le nom du secteur d'origine.

const LOT = 500;

export const normNom = (v) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cleNom = (v) => normNom(v).split(' ').filter(Boolean).sort().join(' ');

// Orthographes rencontrées dans les fichiers sources : trait d'union ou espace.
const variantes = (nom) => [nom, nom.replace(/-/g, ' '), nom.replace(/\s+/g, '-')];

// Renvoie le périmètre du référent connecté, ou null pour les autres rôles.
export async function perimetreAtelier(sr, user) {
  const role = user?.app_role;
  // « commercial_chef_atelier » cumule les deux casquettes : il relève du périmètre
  // atelier de son site (comme un chef d'atelier) en plus de son portefeuille commercial.
  if (role !== 'chef_atelier' && role !== 'responsable_sav' && role !== 'commercial_chef_atelier') return null;

  const bases = await sr.entities.base.list('nom', LOT).catch(() => []);
  const moi = cleNom(user.full_name || user.email || '');
  const champ = role === 'responsable_sav' ? 'responsables_sav' : 'chefs_atelier';
  const mesSites = bases.filter((b) =>
    (b[champ] || []).some((n) => cleNom(n) === moi) ||
    (champ === 'chefs_atelier' && user.base_id && normNom(b.nom) === normNom(user.base_id))
  );
  if (mesSites.length === 0) return { sites: [], noms: [], ids: [], secteurs: [] };

  const noms = [...new Set(mesSites.flatMap((b) => b.commerciaux || []))];
  const fiches = await sr.entities.structure_commerciale.list('-nom_commercial', LOT).catch(() => []);
  const cles = new Set(noms.map(normNom));
  const mesFiches = fiches.filter((f) => cles.has(normNom(f.nom_commercial)));

  // Les RÉFÉRENTS des sites, en plus de leurs commerciaux : un responsable SAV
  // encadre des chefs d'atelier, et leur activité doit entrer dans son
  // périmètre — sinon il les voit sans rien voir de ce qu'ils font.
  const nomsReferents = [...new Set(mesSites.flatMap((b) => [
    ...(b.chefs_atelier || []),
    ...(b.responsables_sav || [])
  ]).filter(Boolean))];
  const comptes = await sr.entities.User.list('-created_date', LOT).catch(() => []);
  const idsReferents = comptesDesChefs(nomsReferents, comptes).ids;

  return {
    sites: mesSites.map((b) => b.nom),
    noms,
    referents: nomsReferents,
    ids: [...new Set([
      ...mesFiches.flatMap((f) => [f.id, f.user_id]),
      ...idsReferents,
      user.id
    ].filter(Boolean))],
    secteurs: [...new Set(mesFiches.flatMap((f) => variantes(f.nom_commercial || '')))]
  };
}

// Périmètre d'un RESPONSABLE COMMERCIAL : les clients de son équipe.
// Le lien ne passe pas par le client (base_responsable_id n'est pas renseigné
// à l'import) mais par la structure : ses vendeurs sont ceux dont il est le
// manager. Rapprochement sur le nom OU sur l'identifiant de son adresse,
// insensible à l'ordre prénom/nom.
export async function perimetreResponsable(sr, user) {
  if (user?.app_role !== 'responsable') return null;

  const fiches = await sr.entities.structure_commerciale.list('-nom_commercial', LOT).catch(() => []);
  const parNom = cleNom(user.full_name || '');
  const parEmail = cleNom(String(user.email || '').split('@')[0].replace(/[._-]+/g, ' '));
  const estMoi = (nom) => {
    const k = cleNom(nom);
    return !!k && (k === parNom || (!!parEmail && k === parEmail));
  };

  const mesFiches = fiches.filter((f) => estMoi(f.manager));
  return {
    noms: mesFiches.map((f) => f.nom_commercial).filter(Boolean),
    ids: [...new Set(mesFiches.flatMap((f) => [f.id, f.user_id]).filter(Boolean))],
    secteurs: [...new Set(mesFiches.flatMap((f) => variantes(f.nom_commercial || '')))]
  };
}

// Périmètre d'un COMMERCIAL : ses clients, par assignation ou par secteur.
// Le second critère est le filet : à l'import, les comptes n'existaient pas
// encore et l'assignation n'a pu se faire qu'après la première connexion.
export async function perimetreCommercial(sr, user) {
  const role = user?.app_role;
  if (role !== 'commercial' && role !== 'agri_precision') return null;

  const fiches = await sr.entities.structure_commerciale.list('-nom_commercial', LOT).catch(() => []);
  const parNom = cleNom(user.full_name || '');
  const parEmail = cleNom(String(user.email || '').split('@')[0].replace(/[._-]+/g, ' '));
  const miennes = fiches.filter((f) =>
    f.user_id === user.id ||
    cleNom(f.nom_commercial) === parNom ||
    (!!parEmail && cleNom(f.nom_commercial) === parEmail)
  );

  return {
    ids: [user.id, ...miennes.map((f) => f.id)],
    secteurs: [...new Set(miennes.flatMap((f) => variantes(f.nom_commercial || '')))]
  };
}

export function filtreClientsPerimetre({ ids, secteurs }) {
  return { $or: [{ commerciaux_assignes: { $in: ids } }, { secteur: { $in: secteurs } }] };
}

// Prédicat pour les filtrages en mémoire (ensembles construits une seule fois).
export function estDansPerimetre({ ids, secteurs }) {
  const sIds = new Set(ids);
  const sNoms = new Set(secteurs.map(normNom));
  return (c) =>
    (c.commerciaux_assignes || []).some((i) => sIds.has(i)) || sNoms.has(normNom(c.secteur));
}

// Le client est-il dans le périmètre du compte connecté ? Même règle que la liste :
// Direction / admin voient tout ; un référent atelier (chef d'atelier, responsable SAV)
// les clients des commerciaux de ses sites et les cibles du fichier atelier de ses sites
// (tableau de répartition) ; un responsable son équipe ; un commercial le sien.
// Sert aux lectures et écritures serveur visant UN client précis : sans ce contrôle,
// une fiche hors périmètre resterait atteignable par son identifiant.
/**
 * Le périmètre bloque-t-il l'accès à UNE fiche précise ?
 *
 * Non, et c'est délibéré. Pendant l'opération, l'outil ne doit jamais empêcher
 * quelqu'un de travailler : toutes les fiches appartiennent à la même
 * opération, tous les comptes sont internes, et un chef d'atelier qui tombe sur
 * un client absent de son tableau de répartition doit pouvoir le traiter plutôt
 * que de se heurter à un refus en pleine prise de rendez-vous.
 *
 * Le périmètre continue de décider ce qu'on AFFICHE par défaut — les listes,
 * les comptages, les classements. Il ne ferme plus l'accès à une fiche nommée.
 *
 * Remettre à true pour rétablir le verrouillage, sans autre changement.
 */
export const RESTREINDRE_PAR_FICHE = false;

export async function clientDansPerimetre(sr, user, client) {
  if (!user || !client) return false;
  if (user.role === 'admin' || user.app_role === 'direction') return true;

  const atelier = await perimetreAtelier(sr, user);
  if (atelier) {
    const mesSites = new Set((atelier.sites || []).map(normNom));
    const site = client.cible_atelier && mesSites.has(normNom(client.site_atelier));
    const nomme = client.cible_atelier && (client.chefs_atelier || []).some((n) => cleNom(n) === cleNom(user.full_name || ''));
    return !!(site || nomme || estDansPerimetre(atelier)(client));
  }

  const equipe = await perimetreResponsable(sr, user);
  if (equipe) return estDansPerimetre(equipe)(client) || client.base_responsable_id === user.id;

  const sien = await perimetreCommercial(sr, user);
  if (sien) return estDansPerimetre(sien)(client);

  return false;
}