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

    // Écran blanc complet : on vide l'activité (RDV, ventes) puis le matériel,
    // et enfin les clients. Ordre = dépendances d'abord. Résumable (lots de BUDGET).
    const ORDRE = ['rdv', 'vente', 'materiel', 'client'];
    let supprimes = 0;
    for (const ent of ORDRE) {
      if (supprimes >= BUDGET) break;
      const rows = await page(ent, sr);
      for (const r of rows) {
        await sr.entities[ent].delete(r.id).catch(() => {});
        supprimes++;
        if (supprimes >= BUDGET) break;
        await sleep(80);
      }
    }

    // Terminé quand il ne reste plus rien dans aucune de ces entités (approx : une page).
    let reste = 0;
    for (const ent of ORDRE) {
      reste += (await sr.entities[ent].list('-created_date', 1)).length;
    }
    return Response.json({ ok: true, supprimes_ce_lot: supprimes, done: reste === 0 });
  } catch (error) {
    return Response.json({ error: `[vider_clients] ${error?.message || String(error)}` }, { status: 500 });
  }
}
