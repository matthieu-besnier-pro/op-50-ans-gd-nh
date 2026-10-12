import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Remet le mur des badges à zéro : supprime les attributions (badge_obtenu),
// sans toucher au catalogue des badges. Déterministe — aucune condition n'est
// évaluée : utile quand des badges hérités de la démo ou d'anciens essais
// restent affichés. Les badges mérités se redécrochent ensuite d'eux-mêmes
// (ou via « Recalculer tous les badges »).
//
// Résumable : à rappeler jusqu'à { done: true }.
// body = { utilisateur_id?: string }  // facultatif : ne vider qu'un commercial

const BUDGET = 60;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin' && user.app_role !== 'direction') {
      return Response.json({ error: 'Réservé à la Direction / Marketing' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const cible = body.utilisateur_id || null;
    const sr = base44.asServiceRole;

    const lot = cible
      ? await sr.entities.badge_obtenu.filter({ utilisateur_id: cible }, '-created_date', BUDGET)
      : await sr.entities.badge_obtenu.list('-created_date', BUDGET);

    let supprimes = 0;
    const echecs = [];
    for (const o of lot) {
      try {
        await sr.entities.badge_obtenu.delete(o.id);
        supprimes++;
      } catch (e) {
        echecs.push(e?.message || String(e));
      }
      await sleep(40);
    }

    const reste = cible
      ? (await sr.entities.badge_obtenu.filter({ utilisateur_id: cible }, '-created_date', 1)).length
      : (await sr.entities.badge_obtenu.list('-created_date', 1)).length;

    return Response.json({
      ok: true,
      supprimes_ce_lot: supprimes,
      // Si rien n'a pu être supprimé alors qu'il reste des lignes, on s'arrête :
      // sinon l'appelant bouclerait à l'infini.
      done: reste === 0 || (supprimes === 0 && lot.length > 0),
      bloque: supprimes === 0 && lot.length > 0,
      echecs: echecs.slice(0, 5)
    });
  } catch (error) {
    return Response.json({ error: `[vider_badges] ${error?.message || String(error)}` }, { status: 500 });
  }
}
