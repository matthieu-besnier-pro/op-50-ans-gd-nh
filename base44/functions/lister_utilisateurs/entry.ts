import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Liste les utilisateurs via le rôle service (l'entité User n'est pas listable
// côté navigateur sur Base44). Réservé Direction / Marketing.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin' && user.app_role !== 'direction') {
      return Response.json({ error: 'Réservé à la Direction / Marketing' }, { status: 403 });
    }

    const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);
    return Response.json({
      users: (users || []).map((u) => ({
        id: u.id,
        full_name: u.full_name || null,
        email: u.email || null,
        role: u.role || null,
        app_role: u.app_role || null,
        base_id: u.base_id || null,
        codes_communes: u.codes_communes || []
      }))
    });
  } catch (error) {
    return Response.json({ error: `[lister_utilisateurs] ${error?.message || String(error)}` }, { status: 500 });
  }
}
