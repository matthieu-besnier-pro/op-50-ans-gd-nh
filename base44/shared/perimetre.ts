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
  if (role !== 'chef_atelier' && role !== 'responsable_sav') return null;

  const bases = await sr.entities.base.list('nom', LOT).catch(() => []);
  const moi = cleNom(user.full_name || user.email || '');
  const champ = role === 'chef_atelier' ? 'chefs_atelier' : 'responsables_sav';
  const mesSites = bases.filter((b) =>
    (b[champ] || []).some((n) => cleNom(n) === moi) ||
    (role === 'chef_atelier' && user.base_id && normNom(b.nom) === normNom(user.base_id))
  );
  if (mesSites.length === 0) return { sites: [], noms: [], ids: [], secteurs: [] };

  const noms = [...new Set(mesSites.flatMap((b) => b.commerciaux || []))];
  const fiches = await sr.entities.structure_commerciale.list('-nom_commercial', LOT).catch(() => []);
  const cles = new Set(noms.map(normNom));
  const mesFiches = fiches.filter((f) => cles.has(normNom(f.nom_commercial)));

  return {
    sites: mesSites.map((b) => b.nom),
    noms,
    ids: [...new Set(mesFiches.flatMap((f) => [f.id, f.user_id]).filter(Boolean))],
    secteurs: [...new Set(mesFiches.flatMap((f) => variantes(f.nom_commercial || '')))]
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