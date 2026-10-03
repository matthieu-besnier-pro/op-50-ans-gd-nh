import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Renvoie les clients selon le rôle, en asServiceRole (contourne le RLS navigateur).
// Optimisé perf : UN seul appel filtré + projection légère (champs de la liste seulement).
//   Direction / admin → clients (jusqu'à `limit`, triés par dernier contact)
//   Responsable       → clients de son équipe (base_responsable_id)
//   Commercial        → ses clients (commerciaux_assignes)
// body.client_id → renvoie UN client complet (repli fiche client).

const LIGHT = [
  'id', 'raison_sociale', 'siren', 'type_structure', 'statut',
  'niveau_appetence', 'score_appetence', 'date_dernier_contact',
  'date_prochain_rdv', 'date_rappel', 'montant_devis',
  'commerciaux_assignes', 'base_responsable_id', 'base_id',
  'tel_mobile', 'adresse_complete', 'type_client_mistra',
  'usages', 'secteur', 'departement', 'parc_total', 'parc_pictos'
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

    const limit = Math.min(Number(body.limit) || 1000, 20000);
    const estDirection = user.role === 'admin' || user.app_role === 'direction';

    let raw;
    if (estDirection) {
      raw = await lireTout((skip) => sr.entities.client.list('id', CHUNK, skip), limit);
    } else if (user.app_role === 'responsable') {
      raw = await lireTout((skip) => sr.entities.client.filter({ base_responsable_id: user.id }, 'id', CHUNK, skip), limit);
    } else {
      raw = await lireTout((skip) => sr.entities.client.filter({ commerciaux_assignes: user.id }, 'id', CHUNK, skip), limit);
    }
    raw = raw || [];

    return Response.json({
      clients: raw.map(pick),
      total: raw.length,
      capped: raw.length >= limit
    });
  } catch (error) {
    return Response.json({ error: `[lister_clients] ${error?.message || String(error)}` }, { status: 500 });
  }
}