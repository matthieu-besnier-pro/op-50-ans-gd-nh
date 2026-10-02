import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Création en masse (clients ou matériel), déjà dédoublonnés côté navigateur.
// body = { entity: 'client' | 'materiel', records: [...] (max ~500) }
// Pour 'client', renvoie le mapping siren -> id (pour rattacher le matériel).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin' && user.app_role !== 'direction') {
      return Response.json({ error: 'Réservé à la Direction / Marketing' }, { status: 403 });
    }
    const sr = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const entity = body.entity === 'materiel' ? 'materiel' : 'client';
    const records = Array.isArray(body.records) ? body.records : [];
    if (records.length === 0) return Response.json({ ok: true, crees: 0, map: {} });

    const created = await sr.entities[entity].bulkCreate(records);

    const map = {};
    if (entity === 'client') {
      (created || []).forEach((c) => { if (c.siren) map[String(c.siren)] = c.id; });
    }
    return Response.json({ ok: true, crees: (created?.length || records.length), map });
  } catch (error) {
    return Response.json({ error: `[creer_clients_lot] ${error?.message || String(error)}` }, { status: 500 });
  }
}
