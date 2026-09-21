import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Renvoie les clients selon le rôle, en asServiceRole (contourne les limites RLS
// côté navigateur — garantit que la Direction/Marketing voit TOUT).
//   Direction / admin  → tous les clients
//   Responsable        → les clients de son équipe (base_responsable_id)
//   Commercial         → ses clients (commerciaux_assignes)
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const sr = base44.asServiceRole;
    const estDirection = user.role === 'admin' || user.app_role === 'direction';

    // Chargement complet (paginé) une seule fois
    const all = [];
    let offset = 0;
    while (all.length < 50000) {
      const batch = await sr.entities.client.list('-date_dernier_contact', 500, offset);
      if (!batch || batch.length === 0) break;
      all.push(...batch);
      offset += batch.length;
      if (batch.length < 500) break;
    }

    let clients;
    if (estDirection) {
      clients = all;
    } else if (user.app_role === 'responsable') {
      clients = all.filter((c) => c.base_responsable_id === user.id);
    } else {
      clients = all.filter((c) => (c.commerciaux_assignes || []).includes(user.id));
    }

    return Response.json({ clients, total: clients.length });
  } catch (error) {
    return Response.json({ error: `[lister_clients] ${error?.message || String(error)}` }, { status: 500 });
  }
}
