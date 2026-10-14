import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { perimetreAtelier, estDansPerimetre } from '../../shared/perimetre.ts';
import { norm } from '../../shared/atelier.ts';

// Changement de statut d'un client depuis la partie SAV.
// Le RLS réserve l'écriture au commercial affecté (ou à la Direction) ; les fiches ciblées par
// l'atelier ne sont assignées à personne. On passe donc par le rôle service, après vérification
// du périmètre du demandeur : chef d'atelier de ce site, ou commercial du site.
// body = { client_id, updates }

const CHAMPS = ['statut', 'date_dernier_contact', 'date_rappel', 'motif_refus', 'nb_tentatives_contact'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = String(body.client_id || '').trim();
    if (!id) return Response.json({ error: 'Client introuvable.' }, { status: 400 });

    const updates = {};
    CHAMPS.forEach((k) => { if (body.updates && body.updates[k] !== undefined) updates[k] = body.updates[k]; });
    if (!updates.statut) return Response.json({ error: 'Statut manquant.' }, { status: 400 });

    const sr = base44.asServiceRole;
    const client = await sr.entities.client.get(id).catch(() => null);
    if (!client) return Response.json({ error: 'Client introuvable.' }, { status: 404 });

    let autorise = user.role === 'admin' || user.app_role === 'direction';
    if (!autorise && user.app_role === 'chef_atelier') {
      const perimetre = await perimetreAtelier(sr, user);
      const monSite = client.cible_atelier && (perimetre.sites || []).map(norm).includes(norm(client.site_atelier));
      const monNom = client.cible_atelier && (client.chefs_atelier || []).some((n) => norm(n) === norm(user.full_name || ''));
      autorise = monSite || monNom || estDansPerimetre(perimetre)(client);
    }
    if (!autorise) return Response.json({ error: "Ce client n'est pas dans votre périmètre SAV." }, { status: 403 });

    const maj = await sr.entities.client.update(id, updates);
    return Response.json({ ok: true, client: maj });
  } catch (error) {
    return Response.json({ error: `[maj_statut_sav] ${error?.message || String(error)}` }, { status: 500 });
  }
}