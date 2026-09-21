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
  'commerciaux_assignes', 'base_responsable_id'
];
const pick = (c) => { const o = {}; for (const k of LIGHT) o[k] = c[k]; return o; };

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

    const limit = Math.min(Number(body.limit) || 1000, 5000);
    const estDirection = user.role === 'admin' || user.app_role === 'direction';

    let raw;
    if (estDirection) {
      raw = await sr.entities.client.list('-date_dernier_contact', limit);
    } else if (user.app_role === 'responsable') {
      raw = await sr.entities.client.filter({ base_responsable_id: user.id }, '-date_dernier_contact', limit);
    } else {
      raw = await sr.entities.client.filter({ commerciaux_assignes: user.id }, '-date_dernier_contact', limit);
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
