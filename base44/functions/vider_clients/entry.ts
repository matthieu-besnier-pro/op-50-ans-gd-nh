import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Vide la base clients (clients + matériel), par petits lots (résumable).
// Réservé Direction / Marketing. À appeler en boucle jusqu'à { done: true }.
const BUDGET = 40;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(entity, sr) {
  const out = [];
  let offset = 0;
  while (out.length < BUDGET) {
    const b = await sr.entities[entity].list('-created_date', 100, offset);
    if (!b || b.length === 0) break;
    out.push(...b);
    offset += b.length;
    if (b.length < 100) break;
  }
  return out;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin' && user.app_role !== 'direction') {
      return Response.json({ error: 'Réservé à la Direction / Marketing' }, { status: 403 });
    }
    const sr = base44.asServiceRole;

    // On supprime d'abord le matériel (dépendances), puis les clients.
    let supprimes = 0;
    const mats = await page('materiel', sr);
    for (const m of mats) {
      await sr.entities.materiel.delete(m.id).catch(() => {});
      supprimes++;
      if (supprimes >= BUDGET) break;
      await sleep(80);
    }
    if (supprimes < BUDGET) {
      const clis = await page('client', sr);
      for (const c of clis) {
        await sr.entities.client.delete(c.id).catch(() => {});
        supprimes++;
        if (supprimes >= BUDGET) break;
        await sleep(80);
      }
    }

    // Compteurs restants (approx : une page)
    const restMat = (await sr.entities.materiel.list('-created_date', 1)).length;
    const restCli = (await sr.entities.client.list('-created_date', 1)).length;
    return Response.json({ ok: true, supprimes_ce_lot: supprimes, done: restMat === 0 && restCli === 0 });
  } catch (error) {
    return Response.json({ error: `[vider_clients] ${error?.message || String(error)}` }, { status: 500 });
  }
}
