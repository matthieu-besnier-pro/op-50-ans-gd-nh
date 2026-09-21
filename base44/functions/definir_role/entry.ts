import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Définit le rôle applicatif d'un utilisateur ET aligne son rôle technique :
// « direction » → role technique 'admin' (accès intégral garanti par les RLS existantes),
// les autres → role technique 'user'. Réservé Direction / Marketing.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (me.role !== 'admin' && me.app_role !== 'direction') {
      return Response.json({ error: 'Réservé à la Direction / Marketing' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { utilisateur_id, app_role, base_id } = body;
    if (!utilisateur_id || !app_role) return Response.json({ error: 'utilisateur_id et app_role requis' }, { status: 400 });

    const patch = { app_role, role: app_role === 'direction' ? 'admin' : 'user' };
    if (base_id !== undefined) patch.base_id = base_id || null;

    await base44.asServiceRole.entities.User.update(utilisateur_id, patch);
    return Response.json({ ok: true, utilisateur_id, ...patch });
  } catch (error) {
    return Response.json({ error: `[definir_role] ${error?.message || String(error)}` }, { status: 500 });
  }
}
