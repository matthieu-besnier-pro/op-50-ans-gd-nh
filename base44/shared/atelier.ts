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