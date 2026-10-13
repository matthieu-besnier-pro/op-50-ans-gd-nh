import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { perimetreAtelier, perimetreResponsable, perimetreCommercial, filtreClientsPerimetre } from '../../shared/perimetre.ts';

// Renvoie les clients selon le rôle, en asServiceRole (contourne le RLS navigateur).
// Optimisé perf : UN seul appel filtré + projection légère (champs de la liste seulement).
//   Direction / admin → clients (jusqu'à `limit`, triés par dernier contact)
//   Responsable       → clients de son équipe (vendeurs dont il est le manager)
//   Commercial        → ses clients (commerciaux_assignes)
// body.client_id → renvoie UN client complet (repli fiche client).

const LIGHT = [
  'id', 'raison_sociale', 'siren', 'type_structure', 'statut',
  'niveau_appetence', 'score_appetence', 'date_dernier_contact',
  'date_prochain_rdv', 'date_rappel', 'montant_devis',
  'commerciaux_assignes', 'base_responsable_id', 'base_id',
  'tel_mobile', 'adresse_complete', 'type_client_mistra',
  'usages', 'secteur', 'departement', 'parc_total', 'parc_pictos',
  'priorite_commercial', 'sources_agri_precision'
];
const pick = (c) => { const o = {}; for (const k of LIGHT) o[k] = c[k]; return o; };

const CHUNK = 5000;

// Lecture paginée complète (tri par identifiant = clé unique, sans doublon ni oubli).
async function lireTout(fetchPage, max) {
  const out = [];
  const vus = new Set();
  for (let i = 0; i < 20 && out.length < max; i++) {
    const page = await fetchPage(i * CHUNK);
    if (!Array.isArray(page) || page.length === 0) break;
    let nouveaux = 0;
    page.forEach((r) => { if (!vus.has(r.id) && out.length < max) { vus.add(r.id); out.push(r); nouveaux += 1; } });
    if (page.length < CHUNK || nouveaux === 0) break;
  }
  return out;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    const sr = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));

    // Fiche client : un seul client complet
    if (body.client_id) {
      const c = await sr.entities.client.get(body.client_id).catch(() => null);
      return Response.json({ clients: c ? [c] : [] });
    }

    // Noms des clients d'une liste d'identifiants — pour le Grand Écran, qui doit
    // afficher « RDV chez X » quel que soit le compte qui projette. Lecture en
    // service role (les droits du navigateur varient selon le profil), et charge
    // minimale : on ne renvoie que l'identifiant et la raison sociale.
    if (Array.isArray(body.noms_client_ids)) {
      const ids = body.noms_client_ids.filter(Boolean).slice(0, 300);
      if (ids.length === 0) return Response.json({ noms: [] });
      const noms = [];
      for (let i = 0; i < ids.length; i += 50) {
        const lot = await sr.entities.client
          .filter({ id: { $in: ids.slice(i, i + 50) } }, '-created_date', 50)
          .catch(() => []);
        (lot || []).forEach((c) => noms.push({ id: c.id, raison_sociale: c.raison_sociale || '' }));
      }
      return Response.json({ noms });
    }

    // Parc matériel d'un client (fiche client) : lecture asServiceRole — le parc de la
    // fiche doit toujours s'afficher, quelles que soient les règles d'accès du navigateur.
    if (body.materiel_client_id) {
      const mats = await sr.entities.materiel.filter({ client_id: body.materiel_client_id }, '-created_date', 500);
      return Response.json({ materiels: mats });
    }

    // Par défaut on renvoie TOUT le périmètre du rôle : un plafond à 1000
    // tronquait les listes et faussait les comptages affichés.
    const limit = Math.min(Number(body.limit) || 20000, 20000);
    const estDirection = user.role === 'admin' || user.app_role === 'direction';

    // Périmètre « atelier » : chef d'atelier / responsable SAV → les clients des
    // commerciaux rattachés à ses sites (tableau de répartition).
    const perimetre = await perimetreAtelier(sr, user);
    const scope = perimetre
      ? { commercial_ids: perimetre.ids, commerciaux: perimetre.noms, sites: perimetre.sites }
      : null;
    if (body.scope_only) return Response.json({ scope });

    let raw;
    if (estDirection) {
      raw = await lireTout((skip) => sr.entities.client.list('id', CHUNK, skip), limit);
    } else if (user.app_role === 'responsable') {
      // Son équipe, déduite de la structure. base_responsable_id reste accepté
      // pour les clients éventuellement rattachés à l'ancienne manière.
      const equipe = await perimetreResponsable(sr, user);
      const filtre = (equipe && (equipe.ids.length > 0 || equipe.secteurs.length > 0))
        ? { $or: [...filtreClientsPerimetre(equipe).$or, { base_responsable_id: user.id }] }
        : { base_responsable_id: user.id };
      raw = await lireTout((skip) => sr.entities.client.filter(filtre, 'id', CHUNK, skip), limit);
    } else if (perimetre) {
      const filtre = filtreClientsPerimetre(perimetre);
      raw = await lireTout((skip) => sr.entities.client.filter(filtre, 'id', CHUNK, skip), limit);
    } else {
      // Ses clients : ceux qui lui sont assignés, et ceux de son secteur — au cas
      // où le rattachement automatique n'aurait pas encore eu lieu.
      const sien = await perimetreCommercial(sr, user);
      const filtre = (sien && sien.secteurs.length > 0)
        ? filtreClientsPerimetre(sien)
        : { commerciaux_assignes: user.id };
      raw = await lireTout((skip) => sr.entities.client.filter(filtre, 'id', CHUNK, skip), limit);
    }
    raw = raw || [];

    return Response.json({
      clients: raw.map(pick),
      total: raw.length,
      capped: raw.length >= limit,
      scope
    });
  } catch (error) {
    return Response.json({ error: `[lister_clients] ${error?.message || String(error)}` }, { status: 500 });
  }
}