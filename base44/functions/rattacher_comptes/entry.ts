import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

// Rattache automatiquement un compte connecté (Microsoft 365, Google ou mot de passe)
// à sa fiche commerciale, sans aucune intervention humaine :
//  1. retrouve la fiche par email, puis par nom complet (« Alexandre BELLIN » = « BELLIN Alexandre »),
//  2. renseigne la fiche (compte lié, email, statut Actif) et déduit le rôle du compte,
//  3. remplace l'ID de fiche par l'ID du compte dans les clients, les matériels et les commentaires,
//  4. pour un responsable : pose le responsable sur les clients et matériels de son équipe.
// Idempotent : un compte déjà rattaché ne redéclenche aucun traitement lourd.

const norm = (v) => String(v || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z]+/g, ' ')
  .replace(/\s+/g, ' ').trim();
const cleNom = (v) => norm(v).split(' ').filter(Boolean).sort().join(' ');
const cleEmail = (email) => cleNom(String(email || '').split('@')[0].replace(/[._-]+/g, ' '));

const LOT = 500;
const MAX_PAGES = 40;

function parLots(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Écritures par vagues de 6 (limite de connexions simultanées du worker).
async function parVagues(taches) {
  for (const vague of parLots(taches, 6)) {
    await Promise.allSettled(vague.map((t) => t()));
  }
}

// Remplace l'ID de la fiche par l'ID du compte dans un champ tableau (clients, matériels, commentaires).
async function remplacerAssignations(entite, ficheId, userId) {
  const maj = [];
  let cursor;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await entite.filter(
      { commerciaux_assignes: ficheId },
      { sort: 'id', limit: 1000, fields: ['id', 'commerciaux_assignes'], cursor }
    );
    page.items.forEach((r) => maj.push({
      id: r.id,
      commerciaux_assignes: (r.commerciaux_assignes || []).map((x) => (x === ficheId ? userId : x))
    }));
    if (!page.has_more) break;
    cursor = page.next_cursor;
  }
  await parVagues(parLots(maj, LOT).map((lot) => () => entite.bulkUpdate(lot)));
  return maj.length;
}

// Parc matériel : il porte le nom du commercial (champ « secteur ») et non l'ID de sa fiche
// → on ajoute l'ID du compte aux machines de ce commercial.
async function poserCommercial(entite, secteur, userId) {
  const maj = [];
  let cursor;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await entite.filter({ secteur }, { sort: 'id', limit: 1000, fields: ['id', 'commerciaux_assignes'], cursor });
    page.items.forEach((r) => {
      const liste = r.commerciaux_assignes || [];
      if (!liste.includes(userId)) maj.push({ id: r.id, commerciaux_assignes: [...liste, userId] });
    });
    if (!page.has_more) break;
    cursor = page.next_cursor;
  }
  await parVagues(parLots(maj, LOT).map((lot) => () => entite.bulkUpdate(lot)));
  return maj.length;
}

// Pose le responsable de l'équipe sur les clients et les matériels concernés.
async function poserResponsable(entite, secteurs, userId) {
  const maj = [];
  let cursor;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await entite.filter(
      { secteur: { $in: secteurs } },
      { sort: 'id', limit: 1000, fields: ['id', 'base_responsable_id'], cursor }
    );
    page.items.filter((r) => r.base_responsable_id !== userId).forEach((r) => maj.push({ id: r.id, base_responsable_id: userId }));
    if (!page.has_more) break;
    cursor = page.next_cursor;
  }
  await parVagues(parLots(maj, LOT).map((lot) => () => entite.bulkUpdate(lot)));
  return maj.length;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    const me = await base44.auth.me().catch(() => null);
    const estDirection = !!me && (me.role === 'admin' || me.app_role === 'direction');
    const cibleId = body.user_id || (me ? me.id : null);
    if (!cibleId) return Response.json({ error: 'user_id requis' }, { status: 400 });
    if (me && cibleId !== me.id && !estDirection) return Response.json({ error: 'Accès refusé' }, { status: 403 });

    let compte = await sr.entities.User.get(cibleId).catch(() => null);
    // Repli : au tout premier signup, l'identifiant peut ne pas être encore lisible → on retrouve le compte par email.
    if (!compte && body.email) {
      const trouves = await sr.entities.User.filter({ email: body.email }).catch(() => []);
      compte = trouves[0] || null;
    }
    if (!compte) return Response.json({ error: 'Compte introuvable' }, { status: 404 });
    // La Direction / Marketing n'a pas de portefeuille : rien à rattacher.
    if (compte.role === 'admin' || compte.app_role === 'direction') {
      return Response.json({ ok: true, rattache: false, motif: 'direction' });
    }

    const fiches = await sr.entities.structure_commerciale.list('-nom_commercial', 200);
    const kNom = cleNom(compte.full_name);
    const kEmail = cleEmail(compte.email);
    const correspond = (nom) => {
      const k = cleNom(nom);
      return !!k && (k === kNom || (kEmail && k === kEmail));
    };

    // 1. Fiche commerciale du compte : email renseigné, compte déjà lié, puis nom complet.
    const candidates = fiches.filter((f) =>
      (f.email && String(f.email).toLowerCase() === String(compte.email || '').toLowerCase()) ||
      f.user_id === compte.id ||
      correspond(f.nom_commercial)
    );
    const fiche = candidates.length === 1 ? candidates[0] : null;

    // 2. Équipe du compte s'il est responsable (les managers n'ont pas toujours de fiche à leur nom).
    const equipe = fiches.filter((f) => correspond(f.manager));

    if (!fiche && equipe.length === 0) {
      return Response.json({ ok: true, rattache: false, motif: `Aucune fiche au nom de ${compte.full_name || compte.email}` });
    }

    // Rôle déduit du rattachement, sans écraser un rôle déjà choisi par la Direction.
    const roleCible = equipe.length > 0 ? 'responsable' : 'commercial';
    const roleActuel = compte.app_role || null;
    const patchCompte = {};
    if ((!roleActuel || roleActuel === 'collaborateur') && roleActuel !== roleCible) patchCompte.app_role = roleCible;

    const dejaLie = !!fiche && fiche.user_id === compte.id;
    if (dejaLie && Object.keys(patchCompte).length === 0) {
      return Response.json({ ok: true, rattache: true, deja: true, fiche: fiche.nom_commercial });
    }

    if (Object.keys(patchCompte).length) await sr.entities.User.update(compte.id, patchCompte);

    const bilan = { clients: 0, materiels: 0, commentaires: 0, clients_equipe: 0, materiels_equipe: 0 };

    if (fiche && !dejaLie) {
      await sr.entities.structure_commerciale.update(fiche.id, {
        user_id: compte.id,
        email: fiche.email || compte.email,
        statut: 'Actif'
      });
      bilan.clients = await remplacerAssignations(sr.entities.client, fiche.id, compte.id);
      bilan.commentaires = await remplacerAssignations(sr.entities.commentaire, fiche.id, compte.id);
    }

    // Parc matériel du commercial (rattaché par son nom dans le champ « secteur »).
    if (fiche) {
      const resteParc = await sr.entities.materiel
        .count({ secteur: fiche.nom_commercial, commerciaux_assignes: { $ne: compte.id } })
        .catch(() => 1);
      if (resteParc > 0) bilan.materiels = await poserCommercial(sr.entities.materiel, fiche.nom_commercial, compte.id);
    }

    if (equipe.length > 0) {
      const secteurs = equipe.map((f) => f.nom_commercial).filter(Boolean);
      const reste = secteurs.length
        ? await sr.entities.client
            .count({ secteur: { $in: secteurs }, base_responsable_id: { $ne: compte.id } })
            .catch(() => 1)
        : 0;
      if (reste > 0) {
        bilan.clients_equipe = await poserResponsable(sr.entities.client, secteurs, compte.id);
        bilan.materiels_equipe = await poserResponsable(sr.entities.materiel, secteurs, compte.id);
      }
    }

    return Response.json({
      ok: true,
      rattache: true,
      compte: compte.email,
      fiche: fiche ? fiche.nom_commercial : null,
      equipe: equipe.length,
      role: patchCompte.app_role || roleActuel,
      ...bilan
    });
  } catch (error) {
    return Response.json({ error: `[rattacher_comptes] ${error?.message || String(error)}` }, { status: 500 });
  }
}