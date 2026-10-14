// Référentiel « SAV — OP 50 ans ».
//
// Normalisation partagée par les deux imports de la partie SAV :
//   - la répartition des CHEFS D'ATELIER par secteur commercial (sites / bases) ;
//   - le fichier consolidé des cibles atelier (clients + machines + offre SAV à proposer).

export const norm = (v) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const cleNom = (v) => norm(v).split(' ').filter(Boolean).sort().join(' ');

export const jetons = (v) => new Set(norm(v).split(' ').filter(Boolean));

// Clé d'un site : les petits mots sont retirés pour rapprocher « Arnac » d'« Arnac-la-Poste ».
const MOTS_VIDES = new Set(['LA', 'LE', 'LES', 'L', 'D', 'SUR', 'SOUS', 'EN', 'SAINT', 'ST', 'SAINTE', 'STE']);
export const cleSite = (v) => norm(v).split(' ').filter((t) => t && !MOTS_VIDES.has(t)).join(' ');

// Suivi atelier : statut unique posé d'un clic par le chef d'atelier dans la liste SAV.
// C'est ce marquage qui compte les prises de contact atelier (un client = un clic) :
// partagé par la mise à jour du statut (maj_statut_sav) et par les exports.
export const STATUT_CONTACT_ATELIER = "Contacté par l'atelier OK pour un RDV";
export const STATUT_CONTACT_ATELIER_REFUS = "Contacté par l'atelier REFUS";

// Les deux issues possibles du contact atelier : le référent en marque une seule.
export const STATUTS_CONTACT_ATELIER = [STATUT_CONTACT_ATELIER, STATUT_CONTACT_ATELIER_REFUS];

export const contactAtelierPose = (client) =>
  STATUTS_CONTACT_ATELIER.includes(client?.statut || '') ||
  (Array.isArray(client?.rdv_obtenus) && STATUTS_CONTACT_ATELIER.some((s) => client.rdv_obtenus.includes(s)));

// Rendez-vous atelier réellement pris : posé dans l'agenda avec son créneau, il
// laisse cette mention sur la fiche client (voir la prise de RDV dans l'outil).
export const STATUT_RDV_ATELIER_OBTENU = 'RDV Atelier obtenu';

// Un rendez-vous atelier est obtenu de DEUX façons, qui se cumulent :
//   - le rendez-vous pris dans l'agenda (mention « RDV Atelier obtenu », avec horaire) ;
//   - la marque du référent d'atelier « OK pour un RDV », posée d'un clic quand le
//     créneau n'est pas encore fixé.
// C'est ce cumul qu'affichent les compteurs de l'opération, un client compté une
// seule fois même s'il porte les deux mentions.
export const rdvAtelierObtenu = (suivis) =>
  (suivis || []).includes(STATUT_CONTACT_ATELIER) || (suivis || []).includes(STATUT_RDV_ATELIER_OBTENU);

// Offres SAV de l'opération : ce sont les OP du fichier atelier.
export const OFFRES_SAV = ['INSPECTION ANNUELLE', 'REVISION', 'CONTRAT DE SERVICE'];

export const offreSav = (v) => {
  const n = norm(v);
  if (!n) return null;
  if (n.includes('INSPECT')) return OFFRES_SAV[0];
  if (n.includes('REVI')) return OFFRES_SAV[1];
  if (n.includes('CONTRAT')) return OFFRES_SAV[2];
  // Libellé inconnu : conservé tel quel, jamais perdu.
  return n;
};

// Catégorie d'opération (pictogrammes) déduite du libellé « Type » du fichier.
export const categorieOp = (v) => {
  const n = norm(v);
  if (!n) return 'AUTRES';
  if (n.includes('PRECISION')) return 'AGRI PRECISION';
  if (n.startsWith('TRACT')) return 'TRACTEURS';
  if (n.startsWith('TELESC')) return 'TELESCOPIQUES';
  if (n.startsWith('ENSIL')) return 'ENSILEUSES';
  if (n.startsWith('MAV') || n.includes('VENDANG') || n.includes('BRAUD')) return 'MAV';
  if (n.startsWith('MB') || n.includes('BATTEUSE') || n.includes('MOISSON')) return 'MB';
  if (n.includes('RB') || n.includes('BB') || n.includes('PRESSE')) return 'BB-RB';
  return 'AUTRES';
};

export const zoneDe = (v) => (norm(v).includes('OUEST') ? 'Ouest' : norm(v).includes('CENTRE') ? 'Centre' : null);

export const entiteDe = (concession) => {
  const n = norm(concession);
  if (n.includes('DBS')) return 'DBS';
  if (n.includes('QUITTE')) return 'Quitte';
  return 'Gonnin Duris';
};

// Site de la base correspondant au nom d'agence d'un fichier (« Arnac » → « Arnac-la-Poste »).
// Le nom du chef d'atelier du fichier départage les candidats ambigus.
export function apparierSite(nomFichier, chefFichier, sites) {
  const c = cleSite(nomFichier);
  if (!c) return null;

  const parChef = (liste) => {
    const t = jetons(chefFichier);
    if (t.size === 0 || liste.length === 0) return null;
    const ok = liste.filter((s) => (s.chefs_atelier || []).some((n) => [...jetons(n)].some((x) => t.has(x))));
    return ok.length === 1 ? ok[0] : null;
  };

  const meme = sites.filter((s) => cleSite(s.nom) === c);
  if (meme.length === 1) return meme[0];
  if (meme.length > 1) return parChef(meme);

  const prefixes = sites.filter((s) => {
    const cs = cleSite(s.nom);
    return cs.startsWith(c) || c.startsWith(cs);
  });
  if (prefixes.length === 1) return prefixes[0];
  if (prefixes.length > 1) {
    const choisi = parChef(prefixes);
    if (choisi) return choisi;
  }

  const t = jetons(nomFichier);
  const partages = sites.filter((s) => [...jetons(s.nom)].some((x) => t.has(x)));
  if (partages.length === 1) return partages[0];
  return parChef(partages);
}

// Comptes correspondant à des noms de chefs d'atelier (« David FIAUD »).
// Un nom n'est retenu que s'il ne désigne qu'un seul compte : en cas d'ambiguïté,
// le nom est signalé pour que la Direction rattache le compte à la main.
export const TYPE_RDV_ATELIER = 'RDV atelier hivernage';

/**
 * À qui revient un rendez-vous : au commerce, ou à l'atelier ?
 *
 * La règle est celle du terrain : les rendez-vous commerciaux sont pris par les
 * commerciaux, les rendez-vous d'atelier par les chefs d'atelier. C'est donc
 * l'AUTEUR qui tranche, et non le type enregistré — la fiche client propose
 * « RDV commercial » par défaut, et des rendez-vous d'atelier s'y sont rangés
 * sans que personne ne le voie.
 *
 * Seul celui qui cumule les deux casquettes (commercial_chef_atelier) se juge
 * sur le type, faute de pouvoir le déduire de son rôle.
 *
 * Renvoie aussi le site de chaque référent, pour rattacher ses rendez-vous.
 */
export function routageRdv(bases, users) {
  const siteParUser = {};

  // Le tableau de répartition nomme les référents de chaque site : c'est lui qui
  // donne le SITE, par rapprochement des noms.
  for (const b of bases || []) {
    const noms = [...(b.chefs_atelier || []), ...(b.responsables_sav || [])];
    comptesDesChefs(noms, users || []).ids.forEach((id) => { siteParUser[id] = b.nom; });
  }

  // Mais c'est le RÔLE DU COMPTE qui dit si quelqu'un est de l'atelier — jamais
  // un rapprochement de noms, qui échoue dès qu'une orthographe diffère entre
  // le tableau et le compte. Un référent absent du tableau restait invisible,
  // et tous ses rendez-vous avec lui.
  const atelier = new Set(Object.keys(siteParUser));
  for (const u of users || []) {
    if (u.app_role !== 'chef_atelier' && u.app_role !== 'responsable_sav') continue;
    atelier.add(u.id);
    if (!siteParUser[u.id] && u.base_id) siteParUser[u.id] = u.base_id;
  }

  const cumul = new Set((users || []).filter((u) => u.app_role === 'commercial_chef_atelier').map((u) => u.id));

  // Dernier filet : si la liste des comptes n'a pas pu être lue, on ne peut
  // juger de personne. Le type vaut alors mieux qu'un écran vide partout.
  const sansComptes = (users || []).length === 0;

  const estAtelier = (rdv) => {
    const id = rdv?.commercial_id;
    if (!id) return false;
    if (sansComptes) return rdv?.type === TYPE_RDV_ATELIER;
    if (cumul.has(id)) return rdv?.type === TYPE_RDV_ATELIER;
    return atelier.has(id);
  };

  return { siteParUser, estAtelier, referents: [...atelier], cumul: [...cumul] };
}

export function comptesDesChefs(noms, users) {
  const ids = new Set();
  const inconnus = [];
  for (const nom of noms || []) {
    const c = cleNom(nom);
    if (!c) continue;
    const t = jetons(nom);
    const candidats = users.filter((u) => {
      const ut = jetons(u.full_name || '');
      return [...t].every((x) => ut.has(x));
    });
    const exacts = candidats.filter((u) => cleNom(u.full_name) === c);
    if (exacts.length > 0) { exacts.forEach((u) => ids.add(u.id)); continue; }
    if (candidats.length === 1) { ids.add(candidats[0].id); continue; }
    inconnus.push(nom);
  }
  return { ids: [...ids], inconnus };
}